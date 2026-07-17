import { NextRequest, NextResponse } from 'next/server'
import { getComfyUIUrl } from '@/lib/setup/config'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${getComfyUIUrl()}/prompt`, {
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
