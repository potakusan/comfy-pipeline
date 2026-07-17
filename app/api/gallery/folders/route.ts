import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getOutputDir, IMAGE_EXT } from "@/lib/server/output-dir";
import { releaseFolderName, type GalleryFolderInfo } from "@/lib/gallery";

const THUMB_DIR = ".thumbcache";

/** GET /api/gallery/folders
 *  Lists generation-batch folders in the output dir (excludes the thumbnail
 *  cache and "*_release" folders, which are derived outputs, not batches).
 */
export async function GET() {
  const outputDir = getOutputDir();
  try {
    const entries = fs.readdirSync(outputDir, { withFileTypes: true });
    const names = entries
      .filter(
        (e) =>
          e.isDirectory() &&
          e.name !== THUMB_DIR &&
          !e.name.endsWith("_release"),
      )
      .map((e) => e.name)
      .sort()
      .reverse();

    const dirs: GalleryFolderInfo[] = names.map((name) => {
      const folderPath = path.join(outputDir, name);
      let count = 0;
      let firstImage: string | null = null;
      try {
        const files = fs
          .readdirSync(folderPath)
          .filter((f) => IMAGE_EXT.test(f))
          .sort();
        count = files.length;
        if (files.length > 0) firstImage = `${name}/${files[0]}`;
      } catch {}

      let releaseCount = 0;
      try {
        const releasePath = path.join(outputDir, releaseFolderName(name));
        releaseCount = fs
          .readdirSync(releasePath)
          .filter((f) => IMAGE_EXT.test(f)).length;
      } catch {}

      return { name, count, firstImage, releaseCount };
    });

    return NextResponse.json({ dirs });
  } catch {
    return NextResponse.json({ dirs: [] });
  }
}
