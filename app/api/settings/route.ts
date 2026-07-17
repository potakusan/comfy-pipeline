import { NextRequest, NextResponse } from "next/server"
import { readSetupConfig, writeSetupConfig, getEnvOverrides } from "@/lib/setup/config"

/** GET /api/settings -> { config, envOverrides } for the settings dialog. */
export async function GET() {
  return NextResponse.json({
    config: readSetupConfig(),
    envOverrides: getEnvOverrides(),
  })
}

/** POST /api/settings  Body: Partial<SetupConfig> — merged into .comfy-pipeline.json. */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const current = readSetupConfig()
  const updated = { ...current, ...body }
  writeSetupConfig(updated)
  return NextResponse.json(updated)
}
