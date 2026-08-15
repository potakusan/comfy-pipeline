import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getOutputDir, safePath, IMAGE_EXT } from "@/lib/server/output-dir";
import { releaseFolderName, type GalleryMosaicImageEntry } from "@/lib/gallery";

/** relFolder(outputDirからの相対パス、"<folder>"または"<folder>_release")配下の
 * "mosaic/"にある画像を列挙する。存在しなければ空配列。 */
function listMosaicImages(outputDir: string, relFolder: string): GalleryMosaicImageEntry[] {
  const mosaicPath = safePath(outputDir, `${relFolder}/mosaic`);
  if (!mosaicPath) return [];
  try {
    return fs
      .readdirSync(mosaicPath)
      .filter((f) => IMAGE_EXT.test(f))
      .sort()
      .map((filename) => ({ filename, path: `${relFolder}/mosaic/${filename}` }));
  } catch {
    return [];
  }
}

/** GET /api/gallery/mosaic/images?folder=20240101-loraname
 *  Lists images in "<folder>/mosaic/" と "<folder>_release/mosaic/" の両方
 *  (automosaic.py はどちらのフォルダに対しても実行されうる) — no sidecar
 *  metadata/release logic, unlike /api/gallery/images.
 */
export async function GET(req: NextRequest) {
  const outputDir = getOutputDir();
  const folder = req.nextUrl.searchParams.get("folder") ?? "";
  if (!folder) return NextResponse.json({ error: "Missing folder" }, { status: 400 });
  if (!safePath(outputDir, folder)) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });

  const images = [
    ...listMosaicImages(outputDir, folder),
    ...listMosaicImages(outputDir, releaseFolderName(folder)),
  ];
  return NextResponse.json({ images });
}
