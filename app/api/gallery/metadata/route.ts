import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getOutputDir, safePath } from "@/lib/server/output-dir";
import type { ImageMetadata } from "@/lib/gallery";
import { apiError } from "@/lib/server/api-error";

/** GET /api/gallery/metadata?path=20240101-loraname/out_00001_.png */
export async function GET(req: NextRequest) {
  const outputDir = getOutputDir();
  const relPath = req.nextUrl.searchParams.get("path") ?? "";
  if (!relPath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const fullPath = safePath(outputDir, relPath);
  if (!fullPath) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  try {
    const raw = fs.readFileSync(`${fullPath}.json`, "utf-8");
    return NextResponse.json({ metadata: JSON.parse(raw) as ImageMetadata });
  } catch {
    return NextResponse.json({ metadata: null });
  }
}

/** POST /api/gallery/metadata  Body: { path, metadata }
 *  Writes "<path>.json" next to the image as a sidecar metadata file.
 */
export async function POST(req: NextRequest) {
  const outputDir = getOutputDir();
  const { path: relPath, metadata } = (await req.json()) as {
    path: string;
    metadata: ImageMetadata;
  };
  if (!relPath || !metadata)
    return NextResponse.json({ error: "Missing path or metadata" }, { status: 400 });

  const fullPath = safePath(outputDir, relPath);
  if (!fullPath) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  try {
    fs.writeFileSync(`${fullPath}.json`, JSON.stringify(metadata, null, 2));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError("gallery/metadata POST", e);
  }
}
