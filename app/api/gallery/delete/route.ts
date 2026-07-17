import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getOutputDir, safePath } from "@/lib/server/output-dir";
import { releaseFolderName } from "@/lib/gallery";

const THUMB_DIR = ".thumbcache";

function unlinkIfExists(p: string) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

/** DELETE /api/gallery/delete  Body: { path: string }
 *  Removes the image, its sidecar JSON, its thumbnail cache entry, and (if
 *  present) the corresponding copy in the "<folder>_release/" folder.
 */
export async function DELETE(req: NextRequest) {
  const outputDir = getOutputDir();
  const { path: relPath } = (await req.json()) as { path: string };
  if (!relPath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const fullPath = safePath(outputDir, relPath);
  if (!fullPath) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const parts = relPath.split("/");
  const folder = parts[0];
  const rest = parts.slice(1).join("/");

  try {
    unlinkIfExists(fullPath);
    unlinkIfExists(`${fullPath}.json`);

    const thumbPath = safePath(outputDir, path.join(THUMB_DIR, `${relPath}.webp`));
    if (thumbPath) unlinkIfExists(thumbPath);

    if (rest) {
      const releasePath = safePath(outputDir, `${releaseFolderName(folder)}/${rest}`);
      if (releasePath) {
        unlinkIfExists(releasePath);
        unlinkIfExists(`${releasePath}.json`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
