import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getOutputDir, safePath, IMAGE_EXT } from "@/lib/server/output-dir";
import { getReleaseRootDir } from "@/lib/setup/config";
import { buildReleaseDir, maxExistingSequence, numberedNames } from "@/lib/gallery-release-copy";

/** POST /api/gallery/mosaic/copy-release  Body: { paths: string[], character: string, group: string }
 *  paths(outputDirからの相対パス、"<folder>/mosaic/..."の画像)を
 *  <releaseRoot>\YYYYMM\YYYYMMDD_キャラクター名\グループ名\ へ 01,02,... に振り直してコピーする。
 *  既に連番ファイルがあるフォルダでは、その続きの番号から振る(上書きしない)。
 */
export async function POST(req: NextRequest) {
  const outputDir = getOutputDir();
  const { paths, character, group } = (await req.json()) as {
    paths?: string[];
    character?: string;
    group?: string;
  };
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ error: "コピーする画像がありません" }, { status: 400 });
  }

  const destDir = buildReleaseDir(getReleaseRootDir(), new Date(), character ?? "", group ?? "");
  if (!destDir) return NextResponse.json({ error: "キャラクター名とグループ名を入力してください" }, { status: 400 });

  const sources = paths
    .filter((p) => /\/mosaic\/[^/]+$/.test(p) && IMAGE_EXT.test(p))
    .map((p) => safePath(outputDir, p))
    .filter((p): p is string => !!p && fs.existsSync(p))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  if (sources.length === 0) return NextResponse.json({ error: "有効な画像がありません" }, { status: 400 });

  try {
    fs.mkdirSync(destDir, { recursive: true });
    const start = maxExistingSequence(fs.readdirSync(destDir)) + 1;
    const names = numberedNames(sources, start);
    sources.forEach((src, i) => fs.copyFileSync(src, path.join(destDir, names[i])));
    return NextResponse.json({ copied: sources.length, destDir, firstName: names[0], lastName: names[names.length - 1] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "コピーに失敗しました" }, { status: 500 });
  }
}
