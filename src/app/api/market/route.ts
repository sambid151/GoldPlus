import { connection, NextResponse } from "next/server";
import { fetchMarket } from "@/lib/market";

// Route handlers are dynamic by default under Cache Components; no segment config needed.
export async function GET() {
  await connection();
  const data = await fetchMarket();
  const status = data.quotes.length === 0 ? 502 : 200;
  return NextResponse.json(data, { status, headers: {
      // CDN-cache briefly so page views cannot turn this route into an open proxy to the upstream feed.
      "Cache-Control": status === 200 ? "public, s-maxage=60, stale-while-revalidate=120" : "no-store",
    } });
}
