import { NextRequest, NextResponse } from "next/server"
import { readSetupConfig, writeSetupConfig } from "@/lib/setup/config"

export async function GET() {
  return NextResponse.json(readSetupConfig())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const current = readSetupConfig()
  const updated = { ...current, ...body }
  writeSetupConfig(updated)
  return NextResponse.json(updated)
}
