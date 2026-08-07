import { NextRequest, NextResponse } from "next/server"
import { readSetupConfig, writeSetupConfig, validateSetupConfig } from "@/lib/setup/config"

export async function GET() {
  return NextResponse.json(readSetupConfig())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const error = validateSetupConfig(body)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const current = readSetupConfig()
  const updated = { ...current, ...body }
  writeSetupConfig(updated)
  return NextResponse.json(updated)
}
