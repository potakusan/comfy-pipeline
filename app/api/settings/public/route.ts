import { NextResponse } from "next/server"
import { getComfyUIUrl, getComfyUIApiKey } from "@/lib/setup/config"

/**
 * GET /api/settings/public
 * Client-safe subset of settings, fetched at runtime instead of relying on
 * NEXT_PUBLIC_* vars (which get baked into the bundle at build time and
 * can't be changed without a rebuild).
 */
export async function GET() {
  return NextResponse.json({
    comfyuiUrl: getComfyUIUrl(),
    comfyuiApiKey: getComfyUIApiKey() ?? null,
  })
}
