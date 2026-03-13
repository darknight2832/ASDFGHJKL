import { NextResponse } from "next/server";
import { FRED_SERIES_BY_METAL } from "@/lib/metal";
import { getSessionFromRequest } from "@/lib/session";

const METALS_API_BASE = "https://metals-api.com/api/timeseries";
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const METALS_CHUNK_DAYS = 30;

const toISO = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const clampEndDate = (date: Date) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (date >= today) {
    return addDays(today, -1);
  }
  return date;
};

const diffDays = (start: Date, end: Date) =>
  Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

const chunkRange = (start: Date, end: Date, size: number) => {
  const chunks: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const chunkEnd = addDays(cursor, size - 1);
    chunks.push({ start: new Date(cursor), end: chunkEnd < end ? chunkEnd : end });
    cursor = addDays(chunkEnd, 1);
  }
  return chunks;
};

const fetchMetalsApiChunk = async ({
  symbol,
  start,
  end,
  base
}: {
  symbol: string;
  start: string;
  end: string;
  base?: string;
}) => {
  const apiKey = process.env.METALS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing METALS_API_KEY environment variable.");
  }

  const url = new URL(METALS_API_BASE);
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", end);
  url.searchParams.set("symbols", symbol);
  if (base) url.searchParams.set("base", base);

  const response = await fetch(url.toString(), { next: { revalidate: 60 } });
  const data = await response.json();

  if (!response.ok || data?.success === false) {
    const message = data?.error?.info || "Metals-API request failed.";
    throw new Error(message);
  }

  const rates = data?.rates ?? {};
  const series = Object.entries(rates)
    .map(([date, symbols]) => {
      const value = (symbols as Record<string, number>)[symbol];
      if (value === undefined) return undefined;
      return { date, value };
    })
    .filter(Boolean) as Array<{ date: string; value: number }>;

  return series;
};

const fetchMetalsApiSeries = async ({
  symbol,
  start,
  end,
  base
}: {
  symbol: string;
  start: Date;
  end: Date;
  base?: string;
}) => {
  const chunks = chunkRange(start, end, METALS_CHUNK_DAYS);
  const results = await Promise.all(
    chunks.map((chunk) =>
      fetchMetalsApiChunk({
        symbol,
        start: toISO(chunk.start),
        end: toISO(chunk.end),
        base
      })
    )
  );

  const merged = new Map<string, number>();
  results.flat().forEach((point) => merged.set(point.date, point.value));

  return Array.from(merged.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const fetchFredSeries = async ({
  seriesId,
  start,
  end
}: {
  seriesId: string;
  start?: string;
  end?: string;
}) => {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error("Missing FRED_API_KEY environment variable.");
  }

  const url = new URL(FRED_BASE);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  if (start) url.searchParams.set("observation_start", start);
  if (end) url.searchParams.set("observation_end", end);

  const response = await fetch(url.toString(), { next: { revalidate: 3600 } });
  const data = await response.json();

  if (!response.ok || data?.error_code) {
    const message = data?.error_message || "FRED request failed.";
    throw new Error(message);
  }

  const observations = data?.observations ?? [];
  const series = observations
    .filter((obs: { value: string }) => obs.value !== ".")
    .map((obs: { date: string; value: string }) => ({
      date: obs.date,
      value: Number.parseFloat(obs.value)
    }))
    .filter((point: { value: number }) => Number.isFinite(point.value));

  return series;
};

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") ?? "metalsapi";
  const symbol = searchParams.get("symbol") ?? "LME-XCU";
  const metalId = searchParams.get("metalId") ?? "copper";
  const base = searchParams.get("base") ?? "USD";

  const rangeDays = Number.parseInt(searchParams.get("range") ?? "365", 10);
  const today = new Date();
  const endDate = clampEndDate(today);
  const startDate = addDays(endDate, -Math.max(rangeDays - 1, 1));

  try {
    if (source === "fred") {
      const seriesId = FRED_SERIES_BY_METAL[metalId];
      if (!seriesId) {
        return NextResponse.json(
          { error: "FRED series not configured for this metal." },
          { status: 400 }
        );
      }
      const series = await fetchFredSeries({
        seriesId,
        start: toISO(startDate),
        end: toISO(endDate)
      });

      return NextResponse.json({
        source: "fred",
        symbol: seriesId,
        rangeDays: diffDays(startDate, endDate) + 1,
        series
      });
    }

    const series = await fetchMetalsApiSeries({
      symbol,
      start: startDate,
      end: endDate,
      base
    });

    return NextResponse.json({
      source: "metalsapi",
      symbol,
      base,
      rangeDays: diffDays(startDate, endDate) + 1,
      series
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
