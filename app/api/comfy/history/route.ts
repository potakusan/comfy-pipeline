import { NextRequest, NextResponse } from 'next/server'

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188'

export async function GET(req: NextRequest) {
  const promptId = req.nextUrl.searchParams.get('promptId')
  const url = promptId
    ? `${COMFYUI_URL}/history/${promptId}`
    : `${COMFYUI_URL}/history`

  try {
    const res = await fetch(url)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 503 })
  }
}
