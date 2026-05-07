import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getOutputDir(): string {
  return (
    process.env.COMFYUI_OUTPUT_DIR ||
    path.join(process.cwd(), "..", "ComfyUI", "output")
  );
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** GET /api/comfy/output/image?path=20240101-loraname/out_00001_.png */
export async function GET(req: NextRequest) {
  const outputDir = getOutputDir();
  const filePath = req.nextUrl.searchParams.get("path") ?? "";

  if (!filePath)
    return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const fullPath = path.resolve(outputDir, filePath);
  if (!fullPath.startsWith(path.resolve(outputDir))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).replace(".", "").toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
