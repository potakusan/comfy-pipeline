import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getOutputDir(): string {
  return (
    process.env.COMFYUI_OUTPUT_DIR ||
    path.join(process.cwd(), "..", "ComfyUI", "output")
  );
}

/**
 * POST /api/comfy/output/save-remote
 * Body: { paths: string[] }  — paths relative to COMFYUI_OUTPUT_DIR, e.g. ["20250521-lora/out_00001_.png"]
 *
 * Downloads each file from the remote machine via /api/comfy/output/image
 * and saves it to the local COMFYUI_OUTPUT_DIR, preserving the folder structure.
 *
 * No-op if REMOTE_PROCESS_URL is not configured.
 */
export async function POST(req: NextRequest) {
  const remoteUrl = process.env.REMOTE_PROCESS_URL;
  if (!remoteUrl) return NextResponse.json({ saved: 0 });

  const { paths } = (await req.json()) as { paths: string[] };
  if (!Array.isArray(paths) || paths.length === 0)
    return NextResponse.json({ saved: 0 });

  const outputDir = getOutputDir();
  let saved = 0;

  for (const relPath of paths) {
    const localFull = path.resolve(outputDir, relPath);
    // Security: reject traversal
    if (!localFull.startsWith(path.resolve(outputDir))) continue;
    // Skip if already on disk
    if (fs.existsSync(localFull)) { saved++; continue; }

    try {
      const res = await fetch(
        `${remoteUrl}/api/comfy/output/image?path=${encodeURIComponent(relPath)}`,
      );
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(localFull), { recursive: true });
      fs.writeFileSync(localFull, buf);
      saved++;
    } catch {
      // best-effort; next file continues
    }
  }

  return NextResponse.json({ saved });
}
