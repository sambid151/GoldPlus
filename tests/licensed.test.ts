import { afterEach, describe, expect, it, vi } from "vitest";
import { getPath, loadLicensedConfig, LicensedApiProvider, mapLicensedResponse, toNumber, type LicensedConfig } from "@/lib/providers/licensed";
import { getRateProvider } from "@/lib/providers";
import { validateBatch } from "@/lib/validation";

// SYNTHETIC payloads: no vendor is chosen yet, so these exercise the mapper, not a real API.
const NOW = new Date("2026-11-16T10:00:00Z");
const base: LicensedConfig = {
  url: "https://api.example.test/v1/gold",
  apiKey: "k_secret_123",
  keyHeader: "x-api-key",
  keyPrefix: "",
  unit: "gram",
  paths: { "24K": "data.gold.k24", "22K": "data.gold.k22", "18K": "data.gold.k18" },
  deriveMissing: false,
};
const body = { data: { gold: { k24: 13680, k22: "12,540", k18: 10260.5 }, ts: 1_794_739_200 } };

describe("helpers", () => {
  it("reads dot paths including array indexes", () => {
    expect(getPath({ a: { b: [{ c: 7 }] } }, "a.b.0.c")).toBe(7);
    expect(getPath({ a: 1 }, "a.b.c")).toBeUndefined();
    expect(getPath(null, "a")).toBeUndefined();
  });
  it("parses numbers from numbers and formatted strings", () => {
    expect(toNumber(13680)).toBe(13680);
    expect(toNumber("1,09,440.50")).toBe(109440.5);
    expect(toNumber("₹12,540")).toBe(12540);
    expect(toNumber(undefined)).toBeNaN();
    expect(toNumber({})).toBeNaN();
  });
});

describe("mapLicensedResponse", () => {
  it("maps three karats per gram and dates them in IST", () => {
    const r = mapLicensedResponse(body, base, NOW);
    expect(r.current.map((x) => [x.karat, x.pricePerGram])).toEqual([["24K", 13680], ["22K", 12540], ["18K", 10260.5]]);
    expect(r.current.every((x) => x.date === "2026-11-16" && x.source === "licensed")).toBe(true);
    expect(r.history).toEqual([]);
  });
  it("converts vendor units to per-gram", () => {
    const ten = { data: { gold: { k24: 136800, k22: 125400, k18: 102600 } } };
    expect(mapLicensedResponse(ten, { ...base, unit: "10gram" }, NOW).current[0].pricePerGram).toBe(13680);
    const oz = { data: { gold: { k24: 31.1034768 * 13680, k22: 31.1034768 * 12540, k18: 31.1034768 * 10260 } } };
    expect(mapLicensedResponse(oz, { ...base, unit: "troy_ounce" }, NOW).current[0].pricePerGram).toBe(13680);
  });
  it("uses the response date when configured (epoch seconds and ISO)", () => {
    expect(mapLicensedResponse(body, { ...base, datePath: "data.ts" }, NOW).current[0].date).toBe("2026-11-15");
    const iso = { ...body, when: "2026-11-14T20:00:00Z" }; // 01:30 IST on the 15th
    expect(mapLicensedResponse(iso, { ...base, datePath: "when" }, NOW).current[0].date).toBe("2026-11-15");
  });
  it("falls back to fetch date when the response date is unusable", () => {
    expect(mapLicensedResponse({ ...body, when: "soon" }, { ...base, datePath: "when" }, NOW).current[0].date).toBe("2026-11-16");
  });
  it("derives missing karats only when allowed, and labels them", () => {
    const only24 = { data: { gold: { k24: 13680 } } };
    const cfg = { ...base, paths: { "24K": "data.gold.k24" } };
    const r = mapLicensedResponse(only24, { ...cfg, deriveMissing: true }, NOW);
    expect(r.current.map((x) => x.pricePerGram)).toEqual([13680, 12540, 10260]);
    expect(r.current.map((x) => x.source)).toEqual(["licensed", "licensed-derived", "licensed-derived"]);
    // without derivation the missing karats are NaN, which batch validation rejects
    const strict = mapLicensedResponse(only24, cfg, NOW);
    expect(validateBatch(strict.current, {}).ok).toBe(false);
  });
  it("throws when 24K is missing, zero or not a number", () => {
    expect(() => mapLicensedResponse({}, base, NOW)).toThrow(/24K/);
    expect(() => mapLicensedResponse({ data: { gold: { k24: 0 } } }, base, NOW)).toThrow(/24K/);
    expect(() => mapLicensedResponse({ data: { gold: { k24: "n/a" } } }, base, NOW)).toThrow(/24K/);
  });
});

describe("loadLicensedConfig", () => {
  const env = {
    LICENSED_API_URL: "https://api.example.test/v1/gold",
    LICENSED_API_KEY: "abc",
    LICENSED_KEY_HEADER: "x-api-key",
    LICENSED_PATH_24K: "a.b",
  } as unknown as NodeJS.ProcessEnv;

  it("builds a config from env with sane defaults", () => {
    const c = loadLicensedConfig(env);
    expect(c).toMatchObject({ unit: "gram", deriveMissing: false, keyPrefix: "" });
    expect(c.paths).toEqual({ "24K": "a.b", "22K": undefined, "18K": undefined });
  });
  it("rejects http URLs, a missing key placement and a missing 24K path, without echoing the key", () => {
    expect(() => loadLicensedConfig({ ...env, LICENSED_API_URL: "http://x.test" } as NodeJS.ProcessEnv)).toThrow(/https/);
    expect(() => loadLicensedConfig({ ...env, LICENSED_KEY_HEADER: "" } as NodeJS.ProcessEnv)).toThrow(/KEY_HEADER or LICENSED_KEY_PARAM/);
    expect(() => loadLicensedConfig({ ...env, LICENSED_PATH_24K: "" } as NodeJS.ProcessEnv)).toThrow(/paths/);
    try { loadLicensedConfig({ ...env, LICENSED_API_URL: "nope" } as NodeJS.ProcessEnv); } catch (e) { expect(String(e)).not.toContain("abc"); }
  });
});

describe("LicensedApiProvider", () => {
  const ok = (json: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(json), { status }));

  it("sends the key in the configured header with prefix", async () => {
    const f = ok(body);
    await new LicensedApiProvider({ ...base, keyPrefix: "Bearer ", keyHeader: "Authorization" }, f as unknown as typeof fetch).fetchRates();
    const [, init] = f.mock.calls[0] as unknown as [URL, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k_secret_123");
  });
  it("sends the key as a query param when configured", async () => {
    const f = ok(body);
    await new LicensedApiProvider({ ...base, keyHeader: undefined, keyParam: "api_key" }, f as unknown as typeof fetch).fetchRates();
    expect((f.mock.calls[0] as unknown as [URL])[0].searchParams.get("api_key")).toBe("k_secret_123");
  });
  it("reports HTTP failures without leaking the key or URL", async () => {
    const p = new LicensedApiProvider({ ...base, keyHeader: undefined, keyParam: "api_key" }, ok({}, 401) as unknown as typeof fetch);
    const err = await p.fetchRates().catch((e: Error) => e);
    expect((err as Error).message).toBe("Licensed API responded 401");
    expect((err as Error).message).not.toContain("k_secret_123");
  });
  it("fails clearly on a non-JSON body", async () => {
    const f = vi.fn(async () => new Response("<html>oops</html>", { status: 200 }));
    await expect(new LicensedApiProvider(base, f as unknown as typeof fetch).fetchRates()).rejects.toThrow(/non-JSON/);
  });
});

describe("getRateProvider on hosted deployments", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("blocks personal-use providers on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    for (const p of ["saved-html", "goodreturns"]) {
      vi.stubEnv("RATE_PROVIDER", p);
      expect(() => getRateProvider()).toThrow(/personal local use only/);
    }
  });
  it("never defaults to the spot estimate: hosted is read-only published, local is saved-html", () => {
    vi.stubEnv("RATE_PROVIDER", "");
    vi.stubEnv("VERCEL", "1");
    expect(() => getRateProvider()).toThrow(/read-only/);
    vi.stubEnv("RATE_PROVIDER", "spot-estimate"); // only when asked for explicitly
    expect(getRateProvider().id).toBe("spot-estimate");
    vi.stubEnv("RATE_PROVIDER", "licensed");
    vi.stubEnv("LICENSED_API_URL", "");
    expect(() => getRateProvider()).toThrow(/Licensed provider misconfigured/);
    vi.stubEnv("RATE_PROVIDER", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("GOLDPULSE_HOSTED", "");
    expect(getRateProvider().id).toBe("saved-html");
  });
});

describe("isLocalHost", () => {
  it("accepts only this machine, any port", async () => {
    const { isLocalHost } = await import("@/lib/runtime");
    for (const h of ["localhost", "localhost:3000", "127.0.0.1:3500", "[::1]:3000", "LOCALHOST:3000"]) expect(isLocalHost(h)).toBe(true);
    for (const h of ["192.168.1.20:3000", "evil.example", "localhost.evil.example", "127.0.0.1.evil.example:3000", "", null, undefined]) expect(isLocalHost(h)).toBe(false);
  });
});
