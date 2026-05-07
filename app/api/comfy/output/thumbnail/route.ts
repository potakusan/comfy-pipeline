import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const THUMB_WIDTH = 400;
const THUMB_DIR = ".thumbcache";

function getOutputDir(): string {
  return (
    process.env.COMFYUI_OUTPUT_DIR ||
    path.join(process.cwd(), "..", "ComfyUI", "output")
  );
}

/** GET /api/comfy/output/thumbnail?path=20240101-loraname/out_00001_.png */
export async function GET(req: NextRequest) {
  const outputDir = getOutputDir();
  const filePath = req.nextUrl.searchParams.get("path") ?? "";

  if (!filePath)
    return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const fullPath = path.resolve(outputDir, filePath);
  if (!fullPath.startsWith(path.resolve(outputDir))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Cache path: <outputDir>/.thumbcache/<original-path>.webp
  const thumbPath = path.join(outputDir, THUMB_DIR, `${filePath}.webp`);

  try {
    // Serve from cache if it exists
    if (fs.existsSync(thumbPath)) {
      const buffer = fs.readFileSync(thumbPath);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Generate thumbnail
    const thumbDir = path.dirname(thumbPath);
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }

    const buffer = await sharp(fullPath)
      .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    fs.writeFileSync(thumbPath, buffer);

    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate thumbnail" },
      { status: 404 },
    );
  }
}
