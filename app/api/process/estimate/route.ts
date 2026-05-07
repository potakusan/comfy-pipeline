import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getOutputDir(): string {
  return (
    process.env.COMFYUI_OUTPUT_DIR ||
    path.join(process.cwd(), "..", "ComfyUI", "output")
  );
}

const IMAGE_EXTS = /\.(png|jpe?g|webp|avif|bmp)$/i;

function scanDir(dir: string): { count: number; totalBytes: number } {
  let count = 0;
  let totalBytes = 0;
  try {
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (IMAGE_EXTS.test(entry.name)) {
          count++;
          totalBytes += fs.statSync(full).size;
        }
      }
    };
    walk(dir);
  } catch {}
  return { count, totalBytes };
}

/** POST /api/process/estimate
 *  Body: { folder: string, scalePercent: number }
 *  Returns { count, currentBytes, estimatedBytes }
 */
export async function POST(req: NextRequest) {
  const { folder, scalePercent } = await req.json();
  if (!folder) return NextResponse.json({ error: "folder required" }, { status: 400 });

  const outputDir = getOutputDir();
  const folderPath = path.resolve(outputDir, folder);
  if (!folderPath.startsWith(path.resolve(outputDir))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const { count, totalBytes } = scanDir(folderPath);
  const scale = Math.max(1, Math.min(100, scalePercent ?? 100)) / 100;
  // rough estimate: file size scales with pixel count (scale²)
  const estimatedBytes = Math.round(totalBytes * scale * scale);

  return NextResponse.json({ count, currentBytes: totalBytes, estimatedBytes });
}
