"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export interface PublicSettings {
  comfyuiUrl: string;
  comfyuiApiKey: string | null;
}

let cache: PublicSettings | null = null;
let inflight: Promise<PublicSettings> | null = null;

async function fetchPublicSettings(): Promise<PublicSettings> {
  const data = await apiFetch<PublicSettings>("/api/settings/public");
  cache = data;
  return data;
}

/**
 * Client-side substitute for reading NEXT_PUBLIC_COMFYUI_URL / _API_KEY
 * directly from process.env. Those get baked into the bundle at build time
 * and can't change without a rebuild, so we fetch the effective values from
 * /api/settings/public at runtime instead.
 * Returns null until the first fetch resolves.
 */
export function usePublicSettings(): PublicSettings | null {
  const [settings, setSettings] = useState<PublicSettings | null>(cache);

  useEffect(() => {
    if (cache) {
      setSettings(cache);
      return;
    }
    inflight ??= fetchPublicSettings();
    inflight.then(setSettings).catch(() => {});
  }, []);

  return settings;
}
