import { NextRequest, NextResponse } from 'next/server'
import { getComfyUIUrl } from '@/lib/setup/config'

export async function GET(req: NextRequest) {
  const comfyUrl = getComfyUIUrl()
  const promptId = req.nextUrl.searchParams.get('promptId')
  const url = promptId
    ? `${comfyUrl}/history/${promptId}`
    : `${comfyUrl}/history`

  try {
    const res = await fetch(url)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 503 })
  }
}
