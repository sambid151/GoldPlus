import { isHosted } from "@/lib/runtime";
import type { RateRepository } from "./types";
import { FileRateRepository } from "./file-repository";
import { SupabaseRateRepository } from "./supabase-repository";

let instance: RateRepository | undefined;

/** Supabase when configured. A local JSON file is allowed only off-platform (dev). */
export function getRepository(): RateRepository {
  if (instance) return instance;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    instance = new SupabaseRateRepository(url, key);
  } else if (isHosted()) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required on hosted deployments (the filesystem is ephemeral).");
  } else {
    instance = new FileRateRepository();
  }
  return instance;
}

export type { RateRepository };
