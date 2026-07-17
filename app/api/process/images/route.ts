import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getOutputDir } from "@/lib/server/output-dir";

const IMAGE_EXT = /\.(png|jpe?g|webp|avif|bmp)$/i;

/** GET /api/process/images?folder=xxx
 *  Returns sorted list of image relative paths (relative to outputDir).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder");
  if (!folder) return NextResponse.json({ error: "folder required" }, { status: 400 });

  const outputDir = getOutputDir();
  const folderPath = path.resolve(outputDir, folder);
  if (!folderPath.startsWith(path.resolve(outputDir))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => IMAGE_EXT.test(f))
      .sort()
      .map((f) => `${folder}/${f}`);
    return NextResponse.json({ images: files });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
