import { isHosted } from "@/lib/runtime";
import { getPublishedRepository } from "@/lib/published/repository";
import type { RateRepository } from "./types";
import { FileRateRepository } from "./file-repository";
import { SupabaseRateRepository } from "./supabase-repository";

let instance: RateRepository | undefined;

/** Supabase when configured; hosted without it serves the read-only published snapshot; local uses the JSON file. */
export function getRepository(): RateRepository {
  if (instance) return instance;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    instance = new SupabaseRateRepository(url, key);
  } else if (isHosted()) {
    // Hosted without a database: serve the bundled read-only snapshot, never an estimate.
    instance = getPublishedRepository();
  } else {
    instance = new FileRateRepository();
  }
  return instance;
}

export type { RateRepository };
