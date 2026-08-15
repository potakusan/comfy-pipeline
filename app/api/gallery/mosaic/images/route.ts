import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getOutputDir, safePath, IMAGE_EXT } from "@/lib/server/output-dir";
import type { GalleryMosaicImageEntry } from "@/lib/gallery";

/** GET /api/gallery/mosaic/images?folder=20240101-loraname
 *  Lists images in "<folder>/mosaic/" (automosaic.py output) — no sidecar
 *  metadata/release logic, unlike /api/gallery/images.
 */
export async function GET(req: NextRequest) {
  const outputDir = getOutputDir();
  const folder = req.nextUrl.searchParams.get("folder") ?? "";
  if (!folder) return NextResponse.json({ error: "Missing folder" }, { status: 400 });

  const mosaicPath = safePath(outputDir, `${folder}/mosaic`);
  if (!mosaicPath) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });

  try {
    const files = fs
      .readdirSync(mosaicPath)
      .filter((f) => IMAGE_EXT.test(f))
      .sort();

    const images: GalleryMosaicImageEntry[] = files.map((filename) => ({
      filename,
      path: `${folder}/mosaic/${filename}`,
    }));

    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
