import fs from "fs";
import path from "path";
import sharp from "sharp";
import type { OutputImageSettings } from "@/lib/setup/output-format";

const EXT: Record<OutputImageSettings["format"], string> = { png: ".png", jpg: ".jpg", webp: ".webp" };

/** 変換後のファイル名。形式がpngなら変換しないので元の名前のまま。 */
export function convertedFilename(filename: string, format: OutputImageSettings["format"]): string {
  if (format === "png") return filename;
  return filename.replace(/\.[^.]+$/, "") + EXT[format];
}

/** PNG以外へ変換する対象か(既に目的の形式のファイルや、PNG以外の入力は触らない)。 */
export function needsConversion(filename: string, format: OutputImageSettings["format"]): boolean {
  return format !== "png" && /\.png$/i.test(filename);
}

/**
 * `fullPath`のPNGを設定の形式へ変換し、変換後のフルパスを返す。変換を書き切ってから元のPNGを消す。
 * 失敗時は元のPNGを残して例外を投げる。
 */
export async function convertOutputImage(fullPath: string, settings: OutputImageSettings): Promise<string> {
  const dest = path.join(path.dirname(fullPath), convertedFilename(path.basename(fullPath), settings.format));
  if (dest === fullPath) return fullPath;

  // Windowsではsharpがパス入力のファイルハンドルを保持して直後のunlink/削除がEPERMになるため、Bufferで渡す
  const img = sharp(fs.readFileSync(fullPath));
  const tmp = `${dest}.tmp`;
  if (settings.format === "jpg") {
    await img
      .jpeg({ quality: settings.quality, chromaSubsampling: settings.chroma444 ? "4:4:4" : "4:2:0", mozjpeg: true })
      .toFile(tmp);
  } else {
    await img.webp(settings.lossless ? { lossless: true } : { quality: settings.quality }).toFile(tmp);
  }
  fs.renameSync(tmp, dest);
  fs.unlinkSync(fullPath);
  return dest;
}
