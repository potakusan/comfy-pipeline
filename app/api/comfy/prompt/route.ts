import { NextRequest, NextResponse } from 'next/server'

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${COMFYUI_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to connect to ComfyUI' }, { status: 503 })
  }
}
