import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getOutputDir(): string {
  return (
    process.env.COMFYUI_OUTPUT_DIR ||
    path.join(process.cwd(), "..", "ComfyUI", "output")
  );
}

const IMAGE_EXT = /\.(png|jpe?g|webp|avif)$/i;

export interface FolderInfo {
  name: string;
  count: number;
  /** path relative to outputDir, usable with /api/comfy/output/thumbnail?path= */
  firstImage: string | null;
}

/** GET /api/process/dirs
 *  Returns folder metadata (name, image count, first image path) for each
 *  subdirectory in the ComfyUI output dir, excluding "mosaic".
 *  When REMOTE_PROCESS_URL is set, proxies to the remote machine.
 */
export async function GET(req: NextRequest) {
  const remoteUrl = process.env.REMOTE_PROCESS_URL;
  const local = new URL(req.url).searchParams.get("local") === "true";
  if (remoteUrl && !local) {
    const res = await fetch(`${remoteUrl}/api/process/dirs`);
    const data = await res.json();
    return NextResponse.json(data);
  }
  const outputDir = getOutputDir();
  try {
    const entries = fs.readdirSync(outputDir, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory() && e.name !== "mosaic")
      .map((e) => e.name)
      .sort()
      .reverse();

    const dirs: FolderInfo[] = folders.map((name) => {
      const folderPath = path.join(outputDir, name);
      let count = 0;
      let firstImage: string | null = null;
      try {
        const files = fs
          .readdirSync(folderPath)
          .filter((f) => IMAGE_EXT.test(f))
          .sort();
        count = files.length;
        if (files.length > 0) {
          firstImage = `${name}/${files[0]}`;
        }
      } catch {}
      return { name, count, firstImage };
    });

    return NextResponse.json({ dirs, outputDir });
  } catch {
    return NextResponse.json({ dirs: [], outputDir });
  }
}
