import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

const SERPAPI_BASE = "https://serpapi.com/search.json";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing SERPAPI_KEY environment variable." },
      { status: 500 }
    );
  }

  const query = searchParams.get("q") ?? "copper cathode price per kg";
  const location = searchParams.get("location") ?? "United States";
  const gl = searchParams.get("gl") ?? "us";
  const hl = searchParams.get("hl") ?? "en";
  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");
  const limit = Number.parseInt(searchParams.get("limit") ?? "10", 10);

  const url = new URL(SERPAPI_BASE);
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", query);
  url.searchParams.set("location", location);
  url.searchParams.set("gl", gl);
  url.searchParams.set("hl", hl);
  url.searchParams.set("sort_by", "1");
  if (minPrice) url.searchParams.set("min_price", minPrice);
  if (maxPrice) url.searchParams.set("max_price", maxPrice);
  url.searchParams.set("api_key", apiKey);

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 900 } });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error || "SerpAPI request failed." },
        { status: 500 }
      );
    }

    const results = data?.shopping_results || data?.inline_shopping_results || [];
    const sellers = results.slice(0, limit).map((item: any) => ({
      title: item.title,
      price: item.price,
      extracted_price: item.extracted_price,
      link: item.link,
      source: item.source,
      delivery: item.delivery,
      rating: item.rating,
      reviews: item.reviews
    }));

    return NextResponse.json({ query, sellers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
