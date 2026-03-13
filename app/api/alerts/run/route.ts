import { NextResponse } from "next/server";
import { METAL_BY_ID } from "@/lib/metal";
import { getWorkspaces } from "@/lib/workspaces";
import { listAlerts, saveAlerts } from "@/lib/store";
import { sendEmail, sendWhatsApp } from "@/lib/notifications";

const METALS_API_BASE = "https://metals-api.com/api/timeseries";

const toISO = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const fetchLatestPrice = async ({ symbol, base }: { symbol: string; base: string }) => {
  const apiKey = process.env.METALS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing METALS_API_KEY environment variable.");
  }

  const today = new Date();
  const end = addDays(today, -1);
  const start = addDays(end, -7);

  const url = new URL(METALS_API_BASE);
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("start_date", toISO(start));
  url.searchParams.set("end_date", toISO(end));
  url.searchParams.set("symbols", symbol);
  url.searchParams.set("base", base);

  const response = await fetch(url.toString(), { next: { revalidate: 300 } });
  const data = await response.json();
  if (!response.ok || data?.success === false) {
    const message = data?.error?.info || "Metals-API request failed.";
    throw new Error(message);
  }

  const rates = data?.rates ?? {};
  const points = Object.entries(rates)
    .map(([date, symbols]) => ({ date, value: (symbols as Record<string, number>)[symbol] }))
    .filter((point) => point.value !== undefined)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (!points.length) throw new Error("No price data returned.");
  return points[points.length - 1];
};

const isCooldownPassed = (lastTriggeredAt: string | undefined, cooldownHours: number) => {
  if (!lastTriggeredAt) return true;
  const last = new Date(lastTriggeredAt).getTime();
  const next = last + cooldownHours * 60 * 60 * 1000;
  return Date.now() > next;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") || request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = getWorkspaces();
  const summary: Array<{ workspaceId: string; triggered: number }> = [];

  for (const workspace of workspaces) {
    const alerts = await listAlerts(workspace.id);
    const active = alerts.filter((alert) => alert.active);
    if (!active.length) continue;

    const cache = new Map<string, { date: string; value: number }>();
    let triggeredCount = 0;

    for (const alert of active) {
      const metal = METAL_BY_ID.get(alert.metalId);
      if (!metal) continue;
      const cacheKey = `${metal.symbol}|${alert.base}`;

      let latest = cache.get(cacheKey);
      if (!latest) {
        latest = await fetchLatestPrice({ symbol: metal.symbol, base: alert.base });
        cache.set(cacheKey, latest);
      }

      const matches =
        alert.direction === "below"
          ? latest.value <= alert.target
          : latest.value >= alert.target;

      const cooldown = alert.cooldownHours ?? 24;
      if (!matches || !isCooldownPassed(alert.lastTriggeredAt, cooldown)) continue;

      const message =
        `Unitech Cabels Alert: ${metal.name} is ${alert.direction} ${alert.target} ${alert.base}. ` +
        `Latest: ${latest.value.toFixed(2)} (${latest.date}).`;

      if (alert.channel === "whatsapp") {
        await sendWhatsApp({ to: alert.recipient, message });
      } else {
        await sendEmail({
          to: alert.recipient,
          subject: `Metal Alert: ${metal.name} ${alert.direction} ${alert.target} ${alert.base}`,
          html: `<p>${message}</p>`
        });
      }

      alert.lastTriggeredAt = new Date().toISOString();
      triggeredCount += 1;
    }

    if (triggeredCount > 0) {
      await saveAlerts(workspace.id, alerts);
    }

    summary.push({ workspaceId: workspace.id, triggered: triggeredCount });
  }

  return NextResponse.json({ ok: true, summary });
}
