import { NextRequest, NextResponse } from 'next/server'
import { getComfyUIUrl } from '@/lib/setup/config'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const filename = searchParams.get('filename') || ''
  const subfolder = searchParams.get('subfolder') || ''
  const type = searchParams.get('type') || 'output'

  try {
    const url = `${getComfyUIUrl()}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${type}`
    const res = await fetch(url)
    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 503 })
  }
}
