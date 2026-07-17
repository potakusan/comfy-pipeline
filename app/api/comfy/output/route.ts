import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { getOutputDir, safePath, IMAGE_EXT } from '@/lib/server/output-dir'
import { getRemoteProcessUrl } from '@/lib/setup/config'

/** GET /api/comfy/output?subfolder=20240101-loraname
 *  Returns list of image filenames in that subfolder.
 *  If subfolder is empty, returns list of subdirectory names.
 *  When REMOTE_PROCESS_URL is set, proxies to the remote machine.
 */
export async function GET(req: NextRequest) {
  const outputDir = getOutputDir()
  const subfolder = req.nextUrl.searchParams.get('subfolder') ?? ''

  const remoteUrl = getRemoteProcessUrl();
  if (remoteUrl) {
    const proxyUrl = subfolder
      ? `${remoteUrl}/api/comfy/output?subfolder=${encodeURIComponent(subfolder)}`
      : `${remoteUrl}/api/comfy/output`;
    try {
      const res = await fetch(proxyUrl);
      const data = await res.json();
      return NextResponse.json(data);
    } catch {
      return NextResponse.json(subfolder ? { files: [], subfolder } : { dirs: [] });
    }
  }

  if (subfolder) {
    // List image files in subfolder
    const target = safePath(outputDir, subfolder)
    if (!target) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

    try {
      const entries = fs.readdirSync(target)
      const files = entries.filter((f) => IMAGE_EXT.test(f)).sort()
      return NextResponse.json({ files, subfolder })
    } catch {
      return NextResponse.json({ files: [], subfolder })
    }
  } else {
    // List all subdirectories (for gallery refresh)
    try {
      const entries = fs.readdirSync(outputDir, { withFileTypes: true })
      const dirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
        .reverse()
      return NextResponse.json({ dirs })
    } catch {
      return NextResponse.json({ dirs: [] })
    }
  }
}
