import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getOutputDir, safePath, IMAGE_MIME } from "@/lib/server/output-dir";

/** POST /api/gallery/mosaic/save?path=20240101-loraname/mosaic/out_00001__mosaic.png
 *  Overwrites an existing file inside a "<folder>/mosaic/" directory with the
 *  request body bytes (the manually-edited image). Restricted to files whose
 *  parent directory is literally "mosaic" so this endpoint can't be used to
 *  overwrite arbitrary output images.
 */
export async function POST(req: NextRequest) {
  const outputDir = getOutputDir();
  const filePath = req.nextUrl.searchParams.get("path") ?? "";
  if (!filePath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const fullPath = safePath(outputDir, filePath);
  if (!fullPath) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  if (path.basename(path.dirname(fullPath)) !== "mosaic") {
    return NextResponse.json({ error: "Only files inside mosaic/ can be overwritten" }, { status: 400 });
  }
  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(fullPath).replace(".", "").toLowerCase();
  if (!(ext in IMAGE_MIME)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await req.arrayBuffer());
    // fs.writeFileSync(fullPath, ...) truncates the existing file in place, which fails
    // with an opaque "UNKNOWN" error on Windows when another process (e.g. Explorer's
    // thumbnail/preview pane) holds a memory-mapped read handle on it. Writing to a temp
    // file and renaming over the original is an atomic replace that doesn't truncate the
    // original, so it isn't blocked by that lock.
    const tmpPath = `${fullPath}.tmp-${Date.now()}`;
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, fullPath);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
