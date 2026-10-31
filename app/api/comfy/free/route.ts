import { NextResponse } from 'next/server'
import { getComfyUIUrl } from '@/lib/setup/config'

/** ComfyUIが保持しているモデルとキャッシュをVRAM/RAMから解放する */
export async function POST() {
  try {
    const res = await fetch(`${getComfyUIUrl()}/free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
    })
    if (!res.ok) return NextResponse.json({ error: `ComfyUI responded ${res.status}` }, { status: 502 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to free memory' }, { status: 503 })
  }
}
