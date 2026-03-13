import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { listQuotes, saveQuotes, Quote } from "@/lib/store";
import { METAL_BY_ID } from "@/lib/metal";

const toNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeQuote = (input: any, workspaceId: string): Quote => {
  const vendor = String(input.vendor || "").trim();
  const metalId = String(input.metalId || "").trim();
  const unit = input.unit === "ton" ? "ton" : "kg";
  const price = toNumber(input.price);
  const currency = String(input.currency || "").trim() || "USD";

  if (!vendor || !metalId || !price) {
    throw new Error("Missing required fields: vendor, metal, price.");
  }

  if (!METAL_BY_ID.has(metalId)) {
    throw new Error("Unknown metal id.");
  }

  return {
    id: crypto.randomUUID(),
    workspaceId,
    vendor,
    metalId,
    grade: input.grade ? String(input.grade) : undefined,
    unit,
    price,
    currency,
    freightPerKg: toNumber(input.freightPerKg),
    dutyPercent: toNumber(input.dutyPercent),
    taxPercent: toNumber(input.taxPercent),
    otherPerKg: toNumber(input.otherPerKg),
    leadTimeDays: toNumber(input.leadTimeDays),
    paymentTerms: input.paymentTerms ? String(input.paymentTerms) : undefined,
    notes: input.notes ? String(input.notes) : undefined,
    createdAt: new Date().toISOString()
  };
};

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const quotes = await listQuotes(session.workspaceId);
  return NextResponse.json({ quotes });
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [body];
    const quotes = await listQuotes(session.workspaceId);
    const normalized = items.map((item) => normalizeQuote(item, session.workspaceId));
    const updated = [...normalized, ...quotes];
    await saveQuotes(session.workspaceId, updated);
    return NextResponse.json({ quotes: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save quote." },
      { status: 400 }
    );
  }
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

  const quotes = await listQuotes(session.workspaceId);
  const updated = quotes.filter((quote) => quote.id !== id);
  await saveQuotes(session.workspaceId, updated);
  return NextResponse.json({ quotes: updated });
}
