import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getWorkspaceById } from "@/lib/workspaces";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspace = getWorkspaceById(session.workspaceId);
  return NextResponse.json({
    ...session,
    workspaceName: workspace?.name,
    defaultLocation: workspace?.defaultLocation,
    defaultCurrency: workspace?.defaultCurrency
  });
}
