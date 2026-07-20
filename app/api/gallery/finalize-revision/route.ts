import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getOutputDir, safePath } from "@/lib/server/output-dir";
import type { ImageMetadata } from "@/lib/gallery";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** POST /api/gallery/finalize-revision
 *  Body: { folder, tempFilename, sourceFilename, metadata }
 *
 *  Renames the file ComfyUI just wrote (under a throwaway prefix) to
 *  "<sourceBase>_rev_NNNN.<ext>", where NNNN is the next unused increment
 *  for that source image in the folder, and writes the sidecar metadata.
 *  Always operates on the local COMFYUI_OUTPUT_DIR — when running in remote
 *  mode, the caller must first pull the generated file down via
 *  /api/comfy/output/save-remote (see hooks/use-gallery.ts).
 */
export async function POST(req: NextRequest) {
  const outputDir = getOutputDir();
  const { folder, tempFilename, sourceFilename, metadata } = (await req.json()) as {
    folder: string;
    tempFilename: string;
    sourceFilename: string;
    metadata: ImageMetadata;
  };
  if (!folder || !tempFilename || !sourceFilename || !metadata) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const folderPath = safePath(outputDir, folder);
  if (!folderPath) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });

  const tempName = path.basename(tempFilename);
  const sourceName = path.basename(sourceFilename);
  const tempPath = path.join(folderPath, tempName);
  if (!fs.existsSync(tempPath)) {
    return NextResponse.json({ error: "Temp file not found" }, { status: 404 });
  }

  const ext = path.extname(tempName);
  const sourceBase = sourceName.slice(0, sourceName.length - path.extname(sourceName).length);

  let maxN = 0;
  try {
    const re = new RegExp(`^${escapeRegex(sourceBase)}_rev_(\\d+)${escapeRegex(ext)}$`);
    for (const f of fs.readdirSync(folderPath)) {
      const m = re.exec(f);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
  } catch {}

  const newFilename = `${sourceBase}_rev_${String(maxN + 1).padStart(4, "0")}${ext}`;
  const newPath = path.join(folderPath, newFilename);

  try {
    fs.renameSync(tempPath, newPath);
    fs.writeFileSync(
      `${newPath}.json`,
      JSON.stringify({ ...metadata, revisionOf: sourceName }, null, 2),
    );
    return NextResponse.json({ filename: newFilename, path: `${folder}/${newFilename}` });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
