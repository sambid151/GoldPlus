import { connection } from "next/server";
import { toCsv } from "@/lib/manual/rates";
import { getRepository } from "@/lib/repo";
import { isHosted, isLocalHost } from "@/lib/runtime";
import { istDate } from "@/lib/time";

/** Download all stored daily rates as CSV or JSON (a backup you can re-import). Local only. */
export async function GET(request: Request) {
  await connection();
  if (isHosted() || !isLocalHost(request.headers.get("host"))) return new Response("Not found", { status: 404 });

  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";
  const closes = await getRepository().getDailyCloses();
  const stamp = istDate();
  const body = format === "json" ? JSON.stringify(closes, null, 2) : toCsv(closes);
  return new Response(body, {
    headers: {
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="goldpulse-rates-${stamp}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
