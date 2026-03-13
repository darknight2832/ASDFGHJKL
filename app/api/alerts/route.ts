import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { listAlerts, saveAlerts, AlertRule } from "@/lib/store";
import { METAL_BY_ID } from "@/lib/metal";

const toNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeAlert = (input: any, workspaceId: string): AlertRule => {
  const metalId = String(input.metalId || "").trim();
  const direction = input.direction === "above" ? "above" : "below";
  const target = toNumber(input.target);
  const base = String(input.base || "USD").trim() || "USD";
  const channel = input.channel === "whatsapp" ? "whatsapp" : "email";
  const recipient = String(input.recipient || "").trim();
  const cooldownHours = toNumber(input.cooldownHours) ?? 24;

  if (!metalId || target === undefined || !recipient) {
    throw new Error("Missing required fields: metal, target, recipient.");
  }

  if (!METAL_BY_ID.has(metalId)) {
    throw new Error("Unknown metal id.");
  }

  return {
    id: crypto.randomUUID(),
    workspaceId,
    metalId,
    direction,
    target,
    base,
    channel,
    recipient,
    active: input.active !== false,
    cooldownHours,
    createdAt: new Date().toISOString()
  };
};

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const alerts = await listAlerts(session.workspaceId);
  return NextResponse.json({ alerts });
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const alerts = await listAlerts(session.workspaceId);
    const newAlert = normalizeAlert(body, session.workspaceId);
    const updated = [newAlert, ...alerts];
    await saveAlerts(session.workspaceId, updated);
    return NextResponse.json({ alerts: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save alert." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const alerts = await listAlerts(session.workspaceId);
  const updated = alerts.map((alert) => {
    if (alert.id !== id) return alert;
    return {
      ...alert,
      active: body.active === undefined ? alert.active : Boolean(body.active)
    };
  });
  await saveAlerts(session.workspaceId, updated);
  return NextResponse.json({ alerts: updated });
}

export async function DELETE(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const alerts = await listAlerts(session.workspaceId);
  const updated = alerts.filter((alert) => alert.id !== id);
  await saveAlerts(session.workspaceId, updated);
  return NextResponse.json({ alerts: updated });
}
