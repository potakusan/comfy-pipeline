import fs from "fs";
import path from "path";
import { getLoraDatasetDir } from "@/lib/setup/config";
import { safePath } from "@/lib/server/output-dir";
import { buildCaption, reconcileTagLists } from "./caption-format";
import { DANBOORU_REFERER, USER_AGENT } from "./danbooru-client";
import {
  ALLOWED_IMAGE_EXT,
  DEFAULT_INCLUDE_CATEGORIES,
  type DanbooruPost,
  type DanbooruPostTags,
  type DatasetImageEntry,
  type DatasetImageManifest,
  type DatasetInfo,
  type DatasetMeta,
  type TagCategory,
} from "./types";

const FOLDER_RE = /^(\d+)_(.+)$/;
const INVALID_NAME_CHARS = /[\\/:*?"<>|]/;
const ID_RE = /^\d+$/;

function datasetRoot(): string {
  const dir = getLoraDatasetDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function folderName(repeat: number, name: string): string {
  return `${repeat}_${name}`;
}

export function validateDatasetName(name: string): string | null {
  if (!name.trim()) return "名前を入力してください";
  if (INVALID_NAME_CHARS.test(name)) return `使用できない文字が含まれています: ${name}`;
  if (name.startsWith(".")) return "名前の先頭にドットは使用できません";
  return null;
}

function resolveFolderDir(folder: string): string | null {
  if (!FOLDER_RE.test(folder)) return null;
  return safePath(datasetRoot(), folder);
}

function resolveImageId(id: string): number | null {
  return ID_RE.test(id) ? Number(id) : null;
}

function readMeta(dir: string): DatasetMeta | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "_dataset.json"), "utf-8")) as DatasetMeta;
  } catch {
    return null;
  }
}

function writeMeta(dir: string, meta: DatasetMeta): void {
  fs.writeFileSync(path.join(dir, "_dataset.json"), JSON.stringify(meta, null, 2));
}

function countImages(dir: string): number {
  try {
    return fs.readdirSync(dir).filter((f) => f !== "_dataset.json" && f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

export function listDatasets(): DatasetInfo[] {
  const root = datasetRoot();
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && FOLDER_RE.test(e.name))
    .map((e) => {
      const dir = path.join(root, e.name);
      const meta = readMeta(dir);
      if (!meta) return null;
      return { ...meta, folder: e.name, imageCount: countImages(dir) };
    })
    .filter((d): d is DatasetInfo => d !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getDataset(folder: string): DatasetInfo | null {
  const dir = resolveFolderDir(folder);
  if (!dir) return null;
  const meta = readMeta(dir);
  if (!meta) return null;
  return { ...meta, folder, imageCount: countImages(dir) };
}

export function createDataset(input: {
  name: string;
  repeat: number;
  triggerWord: string;
  includeCategories?: TagCategory[];
}): DatasetInfo | { error: string } {
  const nameError = validateDatasetName(input.name);
  if (nameError) return { error: nameError };
  if (!Number.isInteger(input.repeat) || input.repeat < 1) {
    return { error: "repeatは1以上の整数で指定してください" };
  }

  const folder = folderName(input.repeat, input.name.trim());
  const dir = safePath(datasetRoot(), folder);
  if (!dir) return { error: "不正なフォルダ名です" };
  if (fs.existsSync(dir)) return { error: "同名のデータセットが既に存在します" };

  const meta: DatasetMeta = {
    name: input.name.trim(),
    repeat: input.repeat,
    triggerWord: input.triggerWord.trim(),
    includeCategories: input.includeCategories ?? DEFAULT_INCLUDE_CATEGORIES,
    createdAt: Date.now(),
  };
  fs.mkdirSync(dir, { recursive: true });
  writeMeta(dir, meta);
  return { ...meta, folder, imageCount: 0 };
}

/** name/repeatを変更する場合はディレクトリをrenameする。triggerWord/includeCategories変更時は既存画像のcaptionを再生成する。 */
export function updateDataset(
  folder: string,
  updates: Partial<Pick<DatasetMeta, "name" | "repeat" | "triggerWord" | "includeCategories">>,
): DatasetInfo | { error: string } {
  const dir = resolveFolderDir(folder);
  if (!dir || !fs.existsSync(dir)) return { error: "データセットが見つかりません" };
  const meta = readMeta(dir);
  if (!meta) return { error: "データセットが見つかりません" };

  if (updates.name !== undefined) {
    const nameError = validateDatasetName(updates.name);
    if (nameError) return { error: nameError };
  }
  if (updates.repeat !== undefined && (!Number.isInteger(updates.repeat) || updates.repeat < 1)) {
    return { error: "repeatは1以上の整数で指定してください" };
  }

  const nextMeta: DatasetMeta = {
    ...meta,
    ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
    ...(updates.repeat !== undefined ? { repeat: updates.repeat } : {}),
    ...(updates.triggerWord !== undefined ? { triggerWord: updates.triggerWord.trim() } : {}),
    ...(updates.includeCategories !== undefined
      ? { includeCategories: updates.includeCategories }
      : {}),
  };

  let nextDir = dir;
  let nextFolder = folder;
  if (updates.name !== undefined || updates.repeat !== undefined) {
    nextFolder = folderName(nextMeta.repeat, nextMeta.name);
    const target = safePath(datasetRoot(), nextFolder);
    if (!target) return { error: "不正なフォルダ名です" };
    if (target !== dir) {
      if (fs.existsSync(target)) return { error: "同名のデータセットが既に存在します" };
      fs.renameSync(dir, target);
      nextDir = target;
    }
  }

  writeMeta(nextDir, nextMeta);

  if (updates.triggerWord !== undefined || updates.includeCategories !== undefined) {
    for (const entry of listImages(nextFolder)) {
      writeCaption(nextDir, entry.id, nextMeta, entry.manifest);
    }
  }

  return { ...nextMeta, folder: nextFolder, imageCount: countImages(nextDir) };
}

export function deleteDataset(folder: string): boolean {
  const dir = resolveFolderDir(folder);
  if (!dir || !fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

function writeCaption(
  dir: string,
  id: number,
  meta: DatasetMeta,
  manifest: DatasetImageManifest,
): string {
  const caption = buildCaption(meta, manifest);
  fs.writeFileSync(path.join(dir, `${id}.txt`), caption);
  return caption;
}

export function listImages(folder: string): DatasetImageEntry[] {
  const dir = resolveFolderDir(folder);
  if (!dir) return [];
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return files
    .filter((f) => f !== "_dataset.json" && f.endsWith(".json"))
    .map((f) => {
      const id = Number(f.slice(0, -".json".length));
      if (!Number.isInteger(id)) return null;
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as DatasetImageManifest;
      let caption = "";
      try {
        caption = fs.readFileSync(path.join(dir, `${id}.txt`), "utf-8");
      } catch {
        // txt未生成（想定外だが空扱いでフォールバック）
      }
      return {
        id,
        filename: `${id}.${manifest.fileExt}`,
        manifest,
        caption,
      };
    })
    .filter((e): e is DatasetImageEntry => e !== null)
    .sort((a, b) => a.manifest.addedAt - b.manifest.addedAt);
}

export function hasImage(folder: string, danbooruId: number): boolean {
  const dir = resolveFolderDir(folder);
  if (!dir) return false;
  return fs.existsSync(path.join(dir, `${danbooruId}.json`));
}

export async function addImage(
  folder: string,
  post: DanbooruPost,
): Promise<DatasetImageEntry | { error: string }> {
  const dir = resolveFolderDir(folder);
  if (!dir || !fs.existsSync(dir)) return { error: "データセットが見つかりません" };
  const meta = readMeta(dir);
  if (!meta) return { error: "データセットが見つかりません" };

  if (!post.fileUrl || !ALLOWED_IMAGE_EXT.has(post.fileExt)) {
    return { error: "この投稿は画像として取得できません" };
  }
  if (hasImage(folder, post.id)) return { error: "既にこのデータセットに追加されています" };

  const res = await fetch(post.fileUrl, {
    headers: { "User-Agent": USER_AGENT, Referer: DANBOORU_REFERER },
  });
  if (!res.ok) return { error: `画像のダウンロードに失敗しました: HTTP ${res.status}` };
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(dir, `${post.id}.${post.fileExt}`), buffer);

  const manifest: DatasetImageManifest = {
    danbooruId: post.id,
    source: post.source,
    rating: post.rating,
    fileExt: post.fileExt,
    tags: post.tags,
    removedTags: [],
    extraTags: [],
    addedAt: Date.now(),
  };
  fs.writeFileSync(path.join(dir, `${post.id}.json`), JSON.stringify(manifest, null, 2));
  const caption = writeCaption(dir, post.id, meta, manifest);

  return { id: post.id, filename: `${post.id}.${post.fileExt}`, manifest, caption };
}

/**
 * Danbooru以外のURLから追加する画像用。Danbooruの投稿IDに相当する自然なIDが無いため
 * Date.now()を使う（現行のDanbooru投稿IDは7〜8桁、これは13桁なので衝突しない。念のため
 * hasImageで確認し、万一衝突したら+1して再試行する）。ダウンロード・タグ付けは
 * 呼び出し側（tagger.ts・APIルート）で済ませてある前提で、保存だけを担う。
 */
export function addExternalImage(
  folder: string,
  input: { sourceUrl: string; buffer: Buffer; fileExt: string; tags: DanbooruPostTags },
): DatasetImageEntry | { error: string } {
  const dir = resolveFolderDir(folder);
  if (!dir || !fs.existsSync(dir)) return { error: "データセットが見つかりません" };
  const meta = readMeta(dir);
  if (!meta) return { error: "データセットが見つかりません" };
  if (!ALLOWED_IMAGE_EXT.has(input.fileExt)) return { error: "対応していない画像形式です" };

  let id = Date.now();
  while (hasImage(folder, id)) id += 1;

  fs.writeFileSync(path.join(dir, `${id}.${input.fileExt}`), input.buffer);

  const manifest: DatasetImageManifest = {
    danbooruId: id,
    source: input.sourceUrl,
    rating: "g",
    fileExt: input.fileExt,
    tags: input.tags,
    removedTags: [],
    extraTags: [],
    addedAt: Date.now(),
  };
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(manifest, null, 2));
  const caption = writeCaption(dir, id, meta, manifest);

  return { id, filename: `${id}.${input.fileExt}`, manifest, caption };
}

export function updateImageTags(
  folder: string,
  idStr: string,
  removedTags: string[],
  extraTags: string[],
): DatasetImageEntry | { error: string } {
  const dir = resolveFolderDir(folder);
  const id = resolveImageId(idStr);
  if (!dir || !fs.existsSync(dir) || id === null) return { error: "データセットまたは画像が見つかりません" };
  const meta = readMeta(dir);
  const manifestPath = path.join(dir, `${id}.json`);
  if (!meta || !fs.existsSync(manifestPath)) return { error: "データセットまたは画像が見つかりません" };

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as DatasetImageManifest;
  const reconciled = reconcileTagLists(removedTags, extraTags);
  const nextManifest: DatasetImageManifest = { ...manifest, ...reconciled };

  fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2));
  const caption = writeCaption(dir, id, meta, nextManifest);

  return { id, filename: `${id}.${nextManifest.fileExt}`, manifest: nextManifest, caption };
}

export function deleteImage(folder: string, idStr: string): boolean {
  const dir = resolveFolderDir(folder);
  const id = resolveImageId(idStr);
  if (!dir || id === null) return false;
  const manifestPath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(manifestPath)) return false;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as DatasetImageManifest;
  for (const ext of [manifest.fileExt, "json", "txt"]) {
    const p = path.join(dir, `${id}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  return true;
}

/** raw画像配信ルート用。folder/idの両方をバリデートしてから絶対パスを返す。 */
export function resolveImageFile(folder: string, idStr: string): string | null {
  const dir = resolveFolderDir(folder);
  const id = resolveImageId(idStr);
  if (!dir || id === null) return null;
  const manifestPath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as DatasetImageManifest;
  const filePath = path.join(dir, `${id}.${manifest.fileExt}`);
  return fs.existsSync(filePath) ? filePath : null;
}

export function resolveDatasetDir(folder: string): string | null {
  return resolveFolderDir(folder);
}

/** リモートのreceive-folderで使用。フォルダ名の形式検証のみ行い、無ければ作成して返す。 */
export function ensureDatasetDir(folder: string): string | null {
  const dir = resolveFolderDir(folder);
  if (!dir) return null;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
