import { NextResponse } from 'next/server'
import { getComfyUIUrl } from '@/lib/setup/config'

export async function POST() {
  try {
    await fetch(`${getComfyUIUrl()}/interrupt`, { method: 'POST' })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to interrupt' }, { status: 503 })
  }
}
