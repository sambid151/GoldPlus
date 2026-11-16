"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { parseDateFlexible, parseImport, type ParsedRow } from "@/lib/manual/parse";
import { checkRows, deleteDay, saveRows, type RowCheck } from "@/lib/manual/rates";
import { parseRupees } from "@/lib/providers/goodreturns-parser";
import { getRepository } from "@/lib/repo";
import { isHosted, isLocalHost } from "@/lib/runtime";
import { istDate } from "@/lib/time";
import { KARATS, type Karat } from "@/lib/types";

const MAX_UPLOAD_BYTES = 900_000; // stay under the 1 MB Server Action body limit

export interface FormState {
  status: "idle" | "error" | "confirm" | "saved";
  message?: string;
  fieldErrors?: Partial<Record<"date" | Karat, string>>;
  /** Unusual-value warnings the user must acknowledge. */
  confirm?: string[];
  /** Echoed so the form keeps what was typed. */
  values?: { date: string; "24K": string; "22K": string; "18K": string };
}

export interface ImportState {
  status: "idle" | "error" | "preview" | "saved";
  message?: string;
  problems?: string[];
  checks?: RowCheck[];
  storeError?: string | null;
  /** The parsed rows, sent back on confirm and re-validated on the server. */
  payload?: string;
}

/**
 * These actions write to local files with no sign-in, so they never run on a hosted deployment
 * or for a request whose Host is not this machine.
 */
async function assertLocal() {
  if (isHosted() || !isLocalHost((await headers()).get("host"))) {
    throw new Error("Rate entry is only available when GoldPulse runs on your own computer.");
  }
}

const rowsSchema = z.array(
  z.object({
    date: z.string(),
    prices: z.object({ "24K": z.number().optional(), "22K": z.number().optional(), "18K": z.number().optional() }),
    dateAssumed: z.boolean().optional(),
  }),
);

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

function priceField(v: FormDataEntryValue | null): number | undefined {
  const t = text(v);
  return t === "" ? undefined : parseRupees(t);
}

const revalidateAll = () => {
  revalidatePath("/");
  revalidatePath("/data");
};

export async function saveRateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await assertLocal();
  const values = {
    date: text(formData.get("date")),
    "24K": text(formData.get("24K")),
    "22K": text(formData.get("22K")),
    "18K": text(formData.get("18K")),
  };
  const fieldErrors: FormState["fieldErrors"] = {};

  const date = parseDateFlexible(values.date);
  if (!date) fieldErrors.date = "Choose a valid date.";
  const prices: ParsedRow["prices"] = {};
  for (const k of KARATS) {
    const n = priceField(formData.get(k));
    if (n === undefined) {
      if (k === "24K") fieldErrors[k] = "Enter the 24K price per gram.";
    } else if (Number.isNaN(n)) fieldErrors[k] = "Enter a number, like 13680.";
    else prices[k] = n;
  }
  if (Object.keys(fieldErrors).length > 0 || !date) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors, values };
  }

  const outcome = await saveRows(getRepository(), [{ date, prices }], {
    source: "manual",
    confirmed: formData.get("confirmed") === "1",
  });
  if (outcome.ok) {
    revalidateAll();
    return { status: "saved", message: `Saved the rates for ${date}.`, values: { date: istDate(), "24K": "", "22K": "", "18K": "" } };
  }

  const row = outcome.check.rows[0];
  if (outcome.reason === "needs-confirm") return { status: "confirm", message: outcome.message, confirm: row.confirm, values };
  const errs: FormState["fieldErrors"] = {};
  for (const e of row?.errors ?? []) {
    const k = KARATS.find((x) => e.startsWith(x));
    errs[k ?? "date"] = e;
  }
  return { status: "error", message: outcome.reason === "store" ? outcome.message : "Fix the highlighted problems.", fieldErrors: errs, values };
}

async function previewImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await assertLocal();
  let input = text(formData.get("text"));
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) return { status: "error", message: "That file is too large. Keep it under 900 KB." };
    input = await file.text();
  }
  if (!input) return { status: "error", message: "Paste a table or choose a file first." };

  const repo = getRepository();
  const parsed = parseImport(input, istDate());
  if (parsed.rows.length === 0) {
    return { status: "error", message: "No rates were found.", problems: parsed.problems };
  }
  const check = checkRows(parsed.rows, await repo.getDailyCloses(), istDate());
  return { status: "preview", problems: parsed.problems, checks: check.rows, storeError: check.storeError, payload: JSON.stringify(parsed.rows) };
}

async function commitImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await assertLocal();
  let rows: ParsedRow[];
  try {
    rows = rowsSchema.parse(JSON.parse(text(formData.get("payload"))));
  } catch {
    return { status: "error", message: "The preview expired. Paste or upload the data again." };
  }
  const outcome = await saveRows(getRepository(), rows, { source: "import", confirmed: formData.get("confirmed") === "1" });
  if (outcome.ok) {
    revalidateAll();
    return { status: "saved", message: `Saved ${outcome.saved} day${outcome.saved === 1 ? "" : "s"}.` };
  }
  return {
    status: "preview",
    message: outcome.message,
    problems: [],
    checks: outcome.check.rows,
    storeError: outcome.check.storeError,
    payload: JSON.stringify(rows),
  };
}

/** One action for the whole import flow so the latest result (preview or saved) is always what shows. */
export async function importAction(prev: ImportState, formData: FormData): Promise<ImportState> {
  return formData.get("intent") === "commit" ? commitImport(prev, formData) : previewImport(prev, formData);
}

export async function deleteDayAction(formData: FormData): Promise<void> {
  await assertLocal();
  const date = parseDateFlexible(text(formData.get("date")));
  if (!date) return;
  await deleteDay(getRepository(), date);
  revalidateAll();
}
