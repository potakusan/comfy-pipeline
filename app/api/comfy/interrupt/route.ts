import { NextResponse } from 'next/server'

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188'

export async function POST() {
  try {
    await fetch(`${COMFYUI_URL}/interrupt`, { method: 'POST' })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to interrupt' }, { status: 503 })
  }
}
