import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getOutputDir, safePath, IMAGE_EXT } from "@/lib/server/output-dir";
import {
  releaseFolderName,
  type GalleryImageEntry,
  type ImageMetadata,
} from "@/lib/gallery";

function readMeta(fullImagePath: string): ImageMetadata | null {
  try {
    const raw = fs.readFileSync(`${fullImagePath}.json`, "utf-8");
    return JSON.parse(raw) as ImageMetadata;
  } catch {
    return null;
  }
}

/** GET /api/gallery/images?folder=20240101-loraname */
export async function GET(req: NextRequest) {
  const outputDir = getOutputDir();
  const folder = req.nextUrl.searchParams.get("folder") ?? "";
  if (!folder) return NextResponse.json({ error: "Missing folder" }, { status: 400 });

  const folderPath = safePath(outputDir, folder);
  if (!folderPath) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });

  const releasePath = safePath(outputDir, releaseFolderName(folder));

  try {
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => IMAGE_EXT.test(f))
      .sort();

    const images: GalleryImageEntry[] = files.map((filename) => {
      const fullImagePath = path.join(folderPath, filename);
      const releaseFile = releasePath ? path.join(releasePath, filename) : null;
      const released = !!releaseFile && fs.existsSync(releaseFile);
      return {
        filename,
        path: `${folder}/${filename}`,
        releasePath: released ? `${releaseFolderName(folder)}/${filename}` : null,
        meta: readMeta(fullImagePath),
      };
    });

    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
