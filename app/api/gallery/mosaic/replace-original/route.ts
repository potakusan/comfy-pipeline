import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getOutputDir, safePath, IMAGE_EXT } from "@/lib/server/output-dir";

/** automosaic.py の出力名 "<元stem>_mosaic[連番].<ext>" から元stemを取り出す */
const MOSAIC_NAME = /^(.+)_mosaic\d*$/;

/** POST /api/gallery/mosaic/replace-original
 *  Body: { path: "<folder>/mosaic/<stem>_mosaic.png", scalePercent?: number, quality?: number }
 *  Replaces a failed mosaic image with its pre-mosaic original from the parent
 *  folder, resized and converted to JPEG. The new file is "<stem>_mosaic.jpg"
 *  in the same mosaic/ dir (the old mosaic file is removed); returns its path.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { path?: string; scalePercent?: number; quality?: number };
  const relPath = body.path ?? "";
  const scalePercent = Math.min(100, Math.max(1, Math.round(body.scalePercent ?? 40)));
  const quality = Math.min(100, Math.max(1, Math.round(body.quality ?? 100)));

  const outputDir = getOutputDir();
  const mosaicFile = relPath ? safePath(outputDir, relPath) : null;
  if (!mosaicFile) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const mosaicDir = path.dirname(mosaicFile);
  if (path.basename(mosaicDir) !== "mosaic") {
    return NextResponse.json({ error: "Only files inside mosaic/ can be replaced" }, { status: 400 });
  }
  if (!fs.existsSync(mosaicFile)) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const stem = MOSAIC_NAME.exec(path.parse(mosaicFile).name)?.[1];
  if (!stem) return NextResponse.json({ error: "Unexpected mosaic filename" }, { status: 400 });

  const parentDir = path.dirname(mosaicDir);
  const originalName = fs
    .readdirSync(parentDir)
    .find((f) => IMAGE_EXT.test(f) && path.parse(f).name === stem);
  if (!originalName) {
    return NextResponse.json({ error: `元画像が見つかりません: ${stem}` }, { status: 404 });
  }

  try {
    const original = sharp(path.join(parentDir, originalName)).rotate();
    const { width } = await original.metadata();
    const buffer = await original
      .flatten({ background: "#ffffff" })
      .resize({ width: width ? Math.max(1, Math.round((width * scalePercent) / 100)) : undefined })
      .jpeg({ quality })
      .toBuffer();

    const newFile = path.join(mosaicDir, `${stem}_mosaic.jpg`);
    // Windowsでは書込み中のハンドル競合を避けるため、一時ファイル経由のrenameで置き換える
    const tmpPath = `${newFile}.tmp-${Date.now()}`;
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, newFile);
    if (newFile !== mosaicFile) fs.rmSync(mosaicFile, { force: true });

    const newRel = path.relative(outputDir, newFile).split(path.sep).join("/");
    return NextResponse.json({ ok: true, path: newRel });
  } catch {
    return NextResponse.json({ error: "Failed to replace" }, { status: 500 });
  }
}
