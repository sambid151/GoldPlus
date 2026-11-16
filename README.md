# GoldPulse

Private Bhubaneswar gold-rate tracker (24K, 22K, 18K) for personal use on your own computer: today's rate, daily change, history tables, interactive charts, news, and a jewellery price calculator. Next.js 16, TypeScript, Tailwind v4, Recharts.

**Personal use only.** The rate pages you copy from (e.g. Goodreturns) allow personal, non-commercial use, not republishing. GoldPulse runs locally, never scrapes, and refuses to run its entry screen on a hosted deployment.

## Daily workflow (free, no accounts)

1. Open the Bhubaneswar rates page in **your own browser** and copy the rates.
2. In GoldPulse click **Add** (or go to `/data`) and either:
   - type the day's prices (24K required; 22K and 18K optional), or
   - paste the copied table, or upload a saved page (.html) or a CSV, then check the **preview** and save.
3. The dashboard shows the new rate; if today's rate is missing it says so and links to the entry screen.

Entries are validated: no future dates, positive plausible prices, karat prices consistent with each other, and a **confirm step** for a jump over 15% from the neighbouring day (catches a per-10 g price typed by mistake). Saving a date again replaces it (edit). Stored days can be edited, deleted and **exported as CSV or JSON** from `/data` (a backup you can re-import).

CSV format: header `date,24K,22K,18K`; dates as `2026-11-16`, `16/11/2026` or `Nov 16, 2026`; Indian digit grouping (`"13,680"`) is fine. The JSON export can be re-imported too. A date repeated inside one file is reported and the last row wins.

Data lives in `.data/goldpulse.json` (override with `GOLDPULSE_DATA_FILE`). Back it up with the export button or by copying the file.

Data-safety notes: writes go to a temp file and are renamed into place, a corrupt data file is never overwritten (the screen shows an error instead), and deletes need a second click. Exports contain daily prices only (not the change-detection snapshots or ingest state). Saving or importing a date that already exists **replaces** it (the preview says so). Do not run `npm run poll`/`ingest` while saving from the screen: the two processes do not lock each other.

## Data sources and limits

- **Manual, pasted and imported rates** are the default and the only fully permitted path found. Different sites show slightly different Bhubaneswar rates (on 16 Nov 2026: Goodreturns and Groww ₹13,680, Paytm ₹13,847 for 24K). Use one source consistently; GoldPulse keeps one series and refuses to mix a different one into the same data file.
- **No automatic collection by default.** The Goodreturns site's Cloudflare returns 403 to scripts and we do not work around it. Groww, Goldmeter and Paytm terms restrict automated access or copying. IBJA publishes national benchmark rates only. If a site owner permits access, or you take a paid city-level API, implement a `RateProvider`.
- Optional providers still in the code: `saved-html` (reads `.data/goodreturns-bhubaneswar.html`; `npm run ingest`), `licensed` (vendor-neutral JSON mapper), and `spot-estimate`. The estimate is an international-spot figure about 16% **below** the Bhubaneswar retail rate, so it is **off by default** and must never be mixed with retail data.
- 18K history only exists from the first day you store it.
- News is Google News RSS (title, source, date, link only); the market panel uses Yahoo's chart endpoint. Both are unofficial public feeds, labelled "not the local retail rate".

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:3000
```

`npm run dev` and `npm start` listen on **127.0.0.1 only**, so other devices on your network cannot reach the app. The data screens also reject any request whose Host header is not `localhost`, `127.0.0.1` or `[::1]` (this blocks DNS-rebinding pages). Open the app at `http://127.0.0.1:3000`; in dev, hot reload may not connect when you use `localhost`.

Optional: `npm run ingest` re-reads `.data/goodreturns-bhubaneswar.html` (a page you saved yourself).

## Pages

- `/` dashboard: price today with change, rate cards, weight table with daily changes, 7D/30D/90D/All chart (range kept in the URL), day-over-day bars, **daily rates table** (10 days / 30 days / all), **24K by month**, news and market, price calculator.
- `/data` add, import, edit, delete and export (local only).

## Tests and checks

```bash
npm test            # 193 tests: parsers, validation, manual entry and import, history tables, providers, ingest, news, market, calculator
npm run typecheck
npm run lint
npm run build
```

CI (`.github/workflows/ci.yml`) runs all four. Hosting on Vercel is possible for the dashboard with Supabase, but is not recommended for rates you copy from sites that restrict reuse.

Disclaimer: rates are indicative, exclude GST/TCS/levies, and are not investment advice.
