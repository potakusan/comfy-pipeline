import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getOutputDir, safePath } from "./output-dir";
import type { ImageMetadata } from "@/lib/gallery";
import { groupEntriesByRecipe } from "./gallery-recipe-groups";

/** 出力フォルダのライフサイクル(ユーザーがアップロード後にフォルダごと削除する運用)
 * とは独立して、販売用に選んだ画像の縮小JPGとレシピ入りメタデータを永続的に残す保管庫。
 * 配置: `_savedpresets/<folder>/<filename>.jpg` と `<filename>.jpg.json`。 */
export const SAVED_PRESETS_DIR = "_savedpresets";
/** 旧保管庫(seed値とサムネwebpのみ)。読み取り時に SAVED_PRESETS_DIR へ移行する。 */
export const SEED_ARCHIVE_DIR = ".seed-archive";
const IMAGE_MAX_EDGE = 768;
const IMAGE_QUALITY = 80;
const ENTRY_SUFFIX = ".jpg.json";
/** フォルダ単位のマニフェスト(どの一括キュー実行・プリセットで作られた画像群か)。画像エントリとは別に保存する。 */
export const MANIFEST_FILENAME = "_meta.json";

export interface SeedArchiveEntry {
  id: string;
  /** アーカイブ時点の元フォルダ名(フォルダ自体は後で消えている可能性がある。表示用のグルーピングキー) */
  sourceFolder: string;
  sourceFilename: string;
  seed: number;
  upscaleSeed: number | null;
  /** 生成元のBatchPreset.id(一括キュープリセットから生成された場合のみ)。
   * どの一括キューセットを実行すればよいか特定するために使う。 */
  batchPresetId?: string;
  /** 生成時に確定していた `%%name%%` 変数の解決値。引き継ぎ時にランダム要素を再現する初期値。 */
  bindings?: Record<string, string>;
  /** 生成時のサイドカーJSON全体(recipe を含む)。旧エントリには無い。 */
  metadata?: ImageMetadata;
  archivedAt: number;
}

function savedDir(): string {
  return path.join(getOutputDir(), SAVED_PRESETS_DIR);
}

function legacyDir(): string {
  return path.join(getOutputDir(), SEED_ARCHIVE_DIR);
}

/** folder/filenameから決定的なIDを作る。販売用選択の取り消し(DELETE /api/gallery/release)
 * で同じ画像のアーカイブエントリを一意に特定・削除できるようにするため。 */
function archiveIdFor(folder: string, filename: string): string {
  return Buffer.from(`${folder}/${filename}`, "utf-8").toString("base64url");
}

/** `<folder>/<filename>` に対応する保管庫内の JPG のフルパス。出力ディレクトリ外を指す場合は null。 */
function savedImagePath(folder: string, filename: string): string | null {
  return safePath(savedDir(), `${folder}/${filename}.jpg`);
}

async function writeShrunkJpeg(source: string | Buffer, dest: string): Promise<void> {
  const buffer = await sharp(source)
    .resize(IMAGE_MAX_EDGE, IMAGE_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: IMAGE_QUALITY })
    .toBuffer();
  fs.writeFileSync(dest, buffer);
}

/**
 * 画像1枚分の縮小JPGとレシピ入りメタデータを保管庫へ書き込む。販売用選択(POST /api/gallery/release)
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

  const imageDest = savedImagePath(params.folder, params.filename);
  if (!imageDest) return;
  fs.mkdirSync(path.dirname(imageDest), { recursive: true });

  const bindings = params.metadata?.bindings;
  const entry: SeedArchiveEntry = {
    id: archiveIdFor(params.folder, params.filename),
    sourceFolder: params.folder,
    sourceFilename: params.filename,
    seed: settings.seed,
    upscaleSeed: settings.upscaleSeed ?? null,
    batchPresetId: params.metadata?.batchPresetId,
    bindings:
      bindings && Object.keys(bindings).length > 0 ? bindings : undefined,
    metadata: params.metadata ?? undefined,
    archivedAt: Date.now(),
  };
  fs.writeFileSync(`${imageDest}.json`, JSON.stringify(entry, null, 2));

  try {
    await writeShrunkJpeg(params.imagePath, imageDest);
  } catch {
    // 縮小JPGの生成に失敗してもメタデータ(JSON)は保存済みなので致命的ではない
  }
  writeFolderManifest(params.folder);
}

/** フォルダ内の全エントリ(`*.jpg.json`)を読む。 */
function readFolderEntries(folder: string): SeedArchiveEntry[] {
  const dir = safePath(savedDir(), folder);
  if (!dir) return [];
  const files: string[] = [];
  collectEntryFiles(dir, files);
  const entries: SeedArchiveEntry[] = [];
  for (const f of files) {
    try {
      entries.push(JSON.parse(fs.readFileSync(f, "utf-8")) as SeedArchiveEntry);
    } catch {}
  }
  return entries.sort((a, b) => b.archivedAt - a.archivedAt);
}

/**
 * フォルダ内のエントリから `_meta.json` を作り直す。どの一括キュー(セット・実行)の
 * どのプリセットで作られた画像群かを、画像JSONを全部開かずに把握できるようにする。
 */
export function writeFolderManifest(folder: string): void {
  const dir = safePath(savedDir(), folder);
  if (!dir) return;
  const manifestPath = path.join(dir, MANIFEST_FILENAME);
  const entries = readFolderEntries(folder);
  if (entries.length === 0) {
    try {
      fs.unlinkSync(manifestPath);
    } catch {}
    return;
  }

  const groups = groupEntriesByRecipe(entries);
  const runs = new Map<string, { runId: string; setId?: string; setName?: string; startedAt?: number; imageCount: number; presetCount: number }>();
  for (const g of groups) {
    const runId = g.batchRun?.runId ?? "unknown";
    const r = runs.get(runId) ?? {
      runId,
      setId: g.batchRun?.setId,
      setName: g.batchRun?.setName,
      startedAt: g.batchRun?.startedAt,
      imageCount: 0,
      presetCount: 0,
    };
    r.imageCount += g.seeds.length;
    r.presetCount += 1;
    runs.set(runId, r);
  }

  const manifest = {
    schemaVersion: 1,
    folder,
    updatedAt: Date.now(),
    imageCount: entries.length,
    runs: Array.from(runs.values()),
    presets: groups.map((g) => ({
      key: g.key,
      batchPresetId: g.batchPresetId,
      name: g.name,
      queueLabel: g.queueLabel,
      runId: g.batchRun?.runId,
      imageCount: g.seeds.length,
      scene: g.recipe.presets?.selectedScene?.name,
      pose: g.recipe.presets?.selectedPose?.name,
      files: g.seeds.map((s) => s.filename),
    })),
  };
  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  } catch {}
}

/** マニフェストが無いフォルダ(導入前に保存したもの)へ一度だけ作る。 */
function backfillManifests(): void {
  let dirs: fs.Dirent[];
  try {
    dirs = fs.readdirSync(savedDir(), { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    if (fs.existsSync(path.join(savedDir(), d.name, MANIFEST_FILENAME))) continue;
    writeFolderManifest(d.name);
  }
}

/** 販売用選択の取り消し(DELETE /api/gallery/release)に合わせて保管庫(旧保管庫含む)からも取り除く。 */
export function removeArchivedSeed(folder: string, filename: string): void {
  const imageDest = savedImagePath(folder, filename);
  if (imageDest) {
    for (const p of [imageDest, `${imageDest}.json`]) {
      try {
        fs.unlinkSync(p);
      } catch {}
    }
    // フォルダ内の最後の1枚だった場合はマニフェストごと空ディレクトリを残さない
    writeFolderManifest(folder);
    try {
      fs.rmdirSync(path.join(savedDir(), folder));
    } catch {}
  }
  const id = archiveIdFor(folder, filename);
  for (const ext of ["json", "webp"]) {
    try {
      fs.unlinkSync(path.join(legacyDir(), `${id}.${ext}`));
    } catch {}
  }
}

/** 旧保管庫(.seed-archive)のエントリを新レイアウトへ移す。冪等。 */
let legacyMigrated = false;
async function migrateLegacyArchive(): Promise<void> {
  if (legacyMigrated) return;
  const dir = legacyDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    legacyMigrated = true;
    return;
  }

  for (const f of files) {
    try {
      const entry = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as SeedArchiveEntry;
      const dest = savedImagePath(entry.sourceFolder, entry.sourceFilename);
      if (!dest) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (!fs.existsSync(`${dest}.json`)) {
        fs.writeFileSync(`${dest}.json`, JSON.stringify(entry, null, 2));
      }
      const legacyThumb = path.join(dir, `${entry.id}.webp`);
      if (!fs.existsSync(dest) && fs.existsSync(legacyThumb)) {
        // ファイルパスを直接渡すとWindowsでsharpがハンドルを保持し、直後の削除に失敗するためBufferで渡す
        await writeShrunkJpeg(fs.readFileSync(legacyThumb), dest);
      }
      fs.unlinkSync(path.join(dir, f));
      try {
        fs.unlinkSync(legacyThumb);
      } catch {}
    } catch {
      // 壊れたエントリは次回以降に再試行する
    }
  }
  try {
    fs.rmdirSync(dir);
  } catch {}
  legacyMigrated = true;
}

function collectEntryFiles(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collectEntryFiles(full, out);
    else if (e.name.endsWith(ENTRY_SUFFIX)) out.push(full);
  }
}

let manifestsBackfilled = false;

export async function listArchivedSeeds(): Promise<SeedArchiveEntry[]> {
  await migrateLegacyArchive();
  if (!manifestsBackfilled) {
    manifestsBackfilled = true;
    backfillManifests();
  }

  const files: string[] = [];
  collectEntryFiles(savedDir(), files);

  const entries: SeedArchiveEntry[] = [];
  for (const f of files) {
    try {
      entries.push(JSON.parse(fs.readFileSync(f, "utf-8")) as SeedArchiveEntry);
    } catch {}
  }
  return entries.sort((a, b) => b.archivedAt - a.archivedAt);
}

/** アーカイブIDはarchiveIdFor()が生成するbase64url文字列のみを想定する。
 * この関数はAPIルート経由でクエリパラメータをそのまま受け取るため、
 * パストラバーサル防止のため文字種を厳格にチェックし、復元したパスも保管庫内に限定する。 */
export function readArchivedThumbnail(id: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const decoded = Buffer.from(id, "base64url").toString("utf-8");
  const slash = decoded.indexOf("/");
  if (slash <= 0) return null;
  const imagePath = savedImagePath(decoded.slice(0, slash), decoded.slice(slash + 1));
  if (!imagePath) return null;
  try {
    return fs.readFileSync(imagePath);
  } catch {
    return null;
  }
}
