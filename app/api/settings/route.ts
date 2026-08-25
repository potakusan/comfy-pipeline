import { NextRequest, NextResponse } from "next/server"
import { readSetupConfig, applySetupConfigUpdate } from "@/lib/setup/config"

/** GET /api/settings -> { config } for the settings dialog. */
export async function GET() {
  return NextResponse.json({
    config: readSetupConfig(),
  })
}

/** POST /api/settings  Body: Partial<SetupConfig> — merged into .comfy-pipeline.json. */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = applySetupConfigUpdate(body)
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result.config)
}
