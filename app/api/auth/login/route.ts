import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/session";
import { getWorkspaceById, validateWorkspaceKey } from "@/lib/workspaces";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = String(body.workspaceId || "").trim();
    const email = String(body.email || "").trim();
    const key = String(body.key || "").trim();

    if (!workspaceId || !email || !key) {
      return NextResponse.json({ error: "Missing credentials." }, { status: 400 });
    }

    if (!validateWorkspaceKey(workspaceId, key)) {
      return NextResponse.json({ error: "Invalid workspace key." }, { status: 401 });
    }

    const workspace = getWorkspaceById(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    }

    const token = createSessionToken({ workspaceId, email });
    const response = NextResponse.json({ workspaceId, email, workspaceName: workspace.name });
    response.cookies.set("uc_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/"
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 500 }
    );
  }
}
