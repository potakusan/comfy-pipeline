import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getOutputDir, safePath } from "@/lib/server/output-dir";
import { getOutputImageSettings, getRemoteProcessUrl } from "@/lib/setup/config";
import { convertedFilename, convertOutputImage, needsConversion } from "@/lib/server/output-convert";

/**
 * POST /api/comfy/output/convert
 * Body: { folder: string, files: string[] } — folderはoutputDirからの相対、filesはその直下のファイル名
 * Returns: { files: string[] } — 変換後のファイル名(入力と同じ順)。変換しなかった/失敗したものは元の名前のまま。
 *
 * ComfyUIが出力したPNGを設定(outputFormat等)の形式へ変換して元のPNGを消す。リモート処理時はoutputDirが
 * 別マシンのため何もしない。
 */
export async function POST(req: NextRequest) {
  const { folder, files } = (await req.json()) as { folder?: string; files?: string[] };
  if (typeof folder !== "string" || !Array.isArray(files)) {
    return NextResponse.json({ error: "folder and files are required" }, { status: 400 });
  }
  const settings = getOutputImageSettings();
  if (getRemoteProcessUrl() || settings.format === "png") return NextResponse.json({ files });

  const dir = safePath(getOutputDir(), folder);
  if (!dir) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const result: string[] = [];
  for (const name of files) {
    const full = path.basename(name) === name ? path.join(dir, name) : null;
    if (!full || !needsConversion(name, settings.format) || !fs.existsSync(full)) {
      result.push(name);
      continue;
    }
    try {
      await convertOutputImage(full, settings);
      result.push(convertedFilename(name, settings.format));
    } catch (e) {
      console.error("[comfy/output/convert]", name, e);
      result.push(name);
    }
  }
  return NextResponse.json({ files: result });
}
