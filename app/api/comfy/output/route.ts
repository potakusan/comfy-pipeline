import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

function getOutputDir(): string {
  return process.env.COMFYUI_OUTPUT_DIR || path.join(process.cwd(), '..', 'ComfyUI', 'output')
}

function safePath(outputDir: string, subfolder: string): string | null {
  const resolved = path.resolve(outputDir, subfolder)
  // Prevent directory traversal
  if (!resolved.startsWith(path.resolve(outputDir))) return null
  return resolved
}

const IMAGE_EXT = /\.(png|jpg|jpeg|webp|gif)$/i

/** GET /api/comfy/output?subfolder=20240101-loraname
 *  Returns list of image filenames in that subfolder.
 *  If subfolder is empty, returns list of subdirectory names.
 */
export async function GET(req: NextRequest) {
  const outputDir = getOutputDir()
  const subfolder = req.nextUrl.searchParams.get('subfolder') ?? ''

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
