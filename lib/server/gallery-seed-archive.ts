import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getOutputDir } from "./output-dir";
import type { ImageMetadata } from "@/lib/gallery";

/** 出力フォルダのライフサイクル(ユーザーがアップロード後にフォルダごと削除する運用)
 * とは独立して、販売用に選んだ画像のseedだけを永続的に残しておく保管庫。
 * 画像本体ではなく、小さいサムネ(.webp)とシード値等を書いたJSONのみを持つ。 */
export const SEED_ARCHIVE_DIR = ".seed-archive";
const THUMB_WIDTH = 160;

export interface SeedArchiveEntry {
  id: string;
  /** アーカイブ時点の元フォルダ名(フォルダ自体は後で消えている可能性がある。表示用のグルーピングキー) */
  sourceFolder: string;
  sourceFilename: string;
  seed: number;
  upscaleSeed: number | null;
  archivedAt: number;
}

function archiveDir(): string {
  return path.join(getOutputDir(), SEED_ARCHIVE_DIR);
}

/** folder/filenameから決定的なIDを作る。販売用選択の取り消し(DELETE /api/gallery/release)
 * で同じ画像のアーカイブエントリを一意に特定・削除できるようにするため。 */
function archiveIdFor(folder: string, filename: string): string {
  return Buffer.from(`${folder}/${filename}`, "utf-8").toString("base64url");
}

/**
 * 画像1枚分のseed情報を保管庫へ書き込む。販売用選択(POST /api/gallery/release)
 * のタイミングで呼び出す想定。メタデータにseedが無ければ何もしない。
 */
export async function archiveSeed(params: {
  folder: string;
  filename: string;
  imagePath: string;
  metadata: ImageMetadata | null;
}): Promise<void> {
  const settings = params.metadata?.settings;
  if (!settings) return;

  const dir = archiveDir();
  fs.mkdirSync(dir, { recursive: true });
  const id = archiveIdFor(params.folder, params.filename);

  const entry: SeedArchiveEntry = {
    id,
    sourceFolder: params.folder,
    sourceFilename: params.filename,
    seed: settings.seed,
    upscaleSeed: settings.upscaleSeed ?? null,
    archivedAt: Date.now(),
  };
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(entry, null, 2));

  try {
    const buffer = await sharp(params.imagePath)
      .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    fs.writeFileSync(path.join(dir, `${id}.webp`), buffer);
  } catch {
    // サムネ生成に失敗してもseed本体(JSON)は保存済みなので致命的ではない
  }
}

/** 販売用選択の取り消し(DELETE /api/gallery/release)に合わせてアーカイブからも取り除く。 */
export function removeArchivedSeed(folder: string, filename: string): void {
  const dir = archiveDir();
  const id = archiveIdFor(folder, filename);
  try {
    fs.unlinkSync(path.join(dir, `${id}.json`));
  } catch {}
  try {
    fs.unlinkSync(path.join(dir, `${id}.webp`));
  } catch {}
}

export function listArchivedSeeds(): SeedArchiveEntry[] {
  const dir = archiveDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const entries: SeedArchiveEntry[] = [];
  for (const f of files) {
    try {
      entries.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as SeedArchiveEntry);
    } catch {}
  }
  return entries.sort((a, b) => b.archivedAt - a.archivedAt);
}

/** アーカイブIDはarchiveIdFor()が生成するbase64url文字列のみを想定する。
 * この関数はAPIルート経由でクエリパラメータをそのまま受け取るため、
 * パストラバーサル防止のため文字種を厳格にチェックしてから読み込む。 */
export function readArchivedThumbnail(id: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  try {
    return fs.readFileSync(path.join(archiveDir(), `${id}.webp`));
  } catch {
    return null;
  }
}
