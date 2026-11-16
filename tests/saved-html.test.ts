import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SavedHtmlProvider } from "@/lib/providers/saved-html";
import { samplePageHtml } from "./helpers/sample-page";

let dir: string;
beforeEach(() => void (dir = mkdtempSync(path.join(tmpdir(), "goldpulse-saved-"))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("SavedHtmlProvider", () => {
  it("explains how to fix a missing file", async () => {
    const p = new SavedHtmlProvider(path.join(dir, "nope.html"));
    await expect(p.fetchRates()).rejects.toThrow(/Save the Bhubaneswar rates page/);
  });

  it("parses a saved page and stamps it with the file's modified time", async () => {
    const file = path.join(dir, "page.html");
    writeFileSync(file, samplePageHtml());
    const mtime = new Date("2026-11-16T09:30:00Z");
    utimesSync(file, mtime, mtime);

    const r = await new SavedHtmlProvider(file).fetchRates();
    expect(r.current.map((x) => x.pricePerGram)).toEqual([13680, 12540, 10260]);
    expect(r.current[0]).toMatchObject({ fetchedAt: mtime.toISOString(), source: "saved-html" });
  });

  it("fails loudly on a saved page that is not the rates page", async () => {
    const file = path.join(dir, "wrong.html");
    writeFileSync(file, "<html><body>Access denied</body></html>");
    await expect(new SavedHtmlProvider(file).fetchRates()).rejects.toThrow(/not found/);
  });
});
