import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { getOutputDir, safePath, IMAGE_EXT, IMAGE_MIME } from "./output-dir";
import { getComfyUIUrl } from "@/lib/setup/config";
import { getPoseGroup } from "@/lib/gallery";

/**
 * 構図プール。良い構図の下絵を出力ディレクトリのライフサイクルから独立して
 * `.i2i/<グループ>/` に保管し、img2img の下絵としてグループ単位で(生成ごとに
 * ランダムに1枚)使う。詳細は docs/proposals/i2i-reference-pool.md。
 */
export const I2I_DIR = ".i2i";

/** UI 表示専用の縮小画像を置くサブツリー。グループ走査・ステージング対象から除外する
 * (= i2img の下絵には絶対に使われない)。 */
const THUMBS_DIR = ".thumbs";
const THUMB_WIDTH = 256;

function i2iDir(): string {
  return path.join(getOutputDir(), I2I_DIR);
}

/** `<group>/<hash>.png` の縮小画像パス → `.i2i/.thumbs/<group>/<hash>.png.webp` */
function thumbAbsFor(relPath: string): string | null {
  return safePath(i2iDir(), `${THUMBS_DIR}/${relPath}.webp`);
}

/** 縮小 webp を生成して保存する(失敗は握りつぶす — サムネが無くても致命的ではない)。 */
async function writeThumb(relPath: string, srcBuf: Buffer): Promise<void> {
  const thumbAbs = thumbAbsFor(relPath);
  if (!thumbAbs) return;
  try {
    const out = await sharp(srcBuf)
      .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    fs.mkdirSync(path.dirname(thumbAbs), { recursive: true });
    fs.writeFileSync(thumbAbs, out);
  } catch {
    // ignore
  }
}

export interface I2iGroup {
  /** .i2i からの相対グループパス(例 "座り/正面") */
  path: string;
  /** ネストの深さ(0 = 直下)。UI のインデント用。 */
  depth: number;
  /** サブフォルダ含む画像の再帰件数 */
  count: number;
  /** サムネ表示用の画像 .i2i 相対パス(先頭最大4件) */
  thumbnails: string[];
}

/** group パラメータの検証。`..` / 先頭スラッシュ / バックスラッシュ / 制御文字を拒否。 */
function isValidGroup(group: string): boolean {
  if (!group || group.length > 200) return false;
  if (group.startsWith("/") || group.includes("\\")) return false;
  if (/[\x00-\x1f]/.test(group)) return false;
  return group.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}

/** dir 以下(再帰)の画像ファイルを .i2i 相対パスで返す。 */
function walkImages(absDir: string, relBase: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.name === THUMBS_DIR) continue; // 縮小画像サブツリーは対象外
    const rel = relBase ? `${relBase}/${e.name}` : e.name;
    if (e.isDirectory()) {
      out.push(...walkImages(path.join(absDir, e.name), rel));
    } else if (IMAGE_EXT.test(e.name)) {
      out.push(rel);
    }
  }
  return out;
}

/** 画像を含む(再帰的に)全ディレクトリをグループとして列挙する。 */
export function listI2iGroups(): I2iGroup[] {
  const root = i2iDir();
  const groups: I2iGroup[] = [];

  const visit = (absDir: string, rel: string, depth: number) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    const subDirs = entries.filter(
      (e) => e.isDirectory() && e.name !== THUMBS_DIR,
    );
    const images = walkImages(absDir, rel);
    if (rel && images.length > 0) {
      groups.push({
        path: rel,
        depth,
        count: images.length,
        thumbnails: images.slice(0, 4),
      });
    }
    for (const d of subDirs) {
      visit(path.join(absDir, d.name), rel ? `${rel}/${d.name}` : d.name, depth + 1);
    }
  };

  visit(root, "", -1);
  return groups.sort((a, b) => a.path.localeCompare(b.path));
}

export function listGroupImages(group: string): string[] {
  if (!isValidGroup(group)) return [];
  const abs = safePath(i2iDir(), group);
  if (!abs) return [];
  return walkImages(abs, group);
}

/** `.i2i` 全体(全グループ)の画像を .i2i 相対パスで返す。 */
export function listAllImages(): string[] {
  return walkImages(i2iDir(), "");
}

/** ハッシュ(hash 名の basename)から .i2i 相対パスを引く。ステージ済み ComfyUI
 * 入力名 `i2i_<hash>.<ext>` から元画像を特定するために使う。 */
export function findImageRelByHash(hash: string): string | null {
  if (!/^[0-9a-f]{6,40}$/.test(hash)) return null;
  return (
    listAllImages().find((rel) => path.basename(rel).split(".")[0] === hash) ??
    null
  );
}

/** ステージ済み ComfyUI 入力名(`i2i_<hash>.<ext>`)に対応する縮小画像を返す。 */
export async function readThumbForComfyName(
  comfyName: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const m = /^i2i_([0-9a-f]{6,40})\./.exec(comfyName);
  if (!m) return null;
  const rel = findImageRelByHash(m[1]);
  return rel ? readThumb(rel) : null;
}

/** バッファを hash 名で書き込み、`{ rel, created }` を返す。同一内容が既にあれば
 * `created:false`(スキップ)。併せて UI 表示用の縮小 webp を `.thumbs/` へ生成する。 */
export async function addImageFromBuffer(
  group: string,
  buf: Buffer,
  ext: string,
): Promise<{ rel: string; created: boolean } | null> {
  if (!isValidGroup(group)) return null;
  const cleanExt = (IMAGE_EXT.test(`x.${ext}`) ? ext : "png").toLowerCase();
  const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
  const rel = `${group}/${hash}.${cleanExt}`;
  const abs = safePath(i2iDir(), rel);
  if (!abs) return null;
  const existed = fs.existsSync(abs);
  if (!existed) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
  }
  const thumbAbs = thumbAbsFor(rel);
  if (!existed || !thumbAbs || !fs.existsSync(thumbAbs)) {
    await writeThumb(rel, buf);
  }
  return { rel, created: !existed };
}

export function deleteImage(relPath: string): boolean {
  const abs = safePath(i2iDir(), relPath);
  if (!abs || !IMAGE_EXT.test(abs)) return false;
  try {
    fs.unlinkSync(abs);
  } catch {
    return false;
  }
  const thumbAbs = thumbAbsFor(relPath);
  if (thumbAbs) {
    try {
      fs.unlinkSync(thumbAbs);
    } catch {
      // サムネが無くても問題ない
    }
  }
  return true;
}

export function readImage(relPath: string): { buffer: Buffer; mime: string } | null {
  const abs = safePath(i2iDir(), relPath);
  if (!abs || !IMAGE_EXT.test(abs)) return null;
  try {
    const buffer = fs.readFileSync(abs);
    const ext = abs.split(".").pop()!.toLowerCase();
    return { buffer, mime: IMAGE_MIME[ext] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

/**
 * UI 表示用の縮小画像(webp)を返す。未生成なら元画像から生成して保存する
 * (本機能導入前に追加された画像・外部から置かれた画像のための遅延生成)。
 */
export async function readThumb(
  relPath: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const thumbAbs = thumbAbsFor(relPath);
  const abs = safePath(i2iDir(), relPath);
  if (!thumbAbs || !abs || !IMAGE_EXT.test(abs)) return null;
  try {
    return { buffer: fs.readFileSync(thumbAbs), mime: "image/webp" };
  } catch {
    // 未生成: 元画像から作る
  }
  let srcBuf: Buffer;
  try {
    srcBuf = fs.readFileSync(abs);
  } catch {
    return null;
  }
  await writeThumb(relPath, srcBuf);
  try {
    return { buffer: fs.readFileSync(thumbAbs), mime: "image/webp" };
  } catch {
    // 生成に失敗したら元画像で代替
    return { buffer: srcBuf, mime: IMAGE_MIME[abs.split(".").pop()!.toLowerCase()] ?? "application/octet-stream" };
  }
}

/** 出力ディレクトリ相対パスの画像を指定グループへコピーする(ギャラリーからの保存)。 */
export async function addImageFromOutput(
  group: string,
  sourcePath: string,
): Promise<{ rel: string; created: boolean } | null> {
  const src = safePath(getOutputDir(), sourcePath);
  if (!src || !IMAGE_EXT.test(src)) return null;
  let buf: Buffer;
  try {
    buf = fs.readFileSync(src);
  } catch {
    return null;
  }
  const ext = src.split(".").pop()!.toLowerCase();
  return addImageFromBuffer(group, buf, ext);
}

/** ファイル名から推測したポーズ名を .i2i グループ名(1階層)へ整える。 */
function poseGroupName(filename: string): string {
  const clean = getPoseGroup(filename)
    .replace(/[/\\:*?"<>|\x00-\x1f]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return clean || "未分類";
}

/**
 * 出力ディレクトリ内の全 `*_release/`(販売用選択済み)フォルダの画像を、
 * ファイル名から推測したポーズごとに `.i2i/<ポーズ>/` へ取り込む。
 * 既存グループがあれば統合(hash 重複はスキップ)。
 */
export async function importReleasedImagesByPose(): Promise<{
  added: number;
  skipped: number;
  byPose: Record<string, number>;
}> {
  const outDir = getOutputDir();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(outDir, { withFileTypes: true });
  } catch {
    return { added: 0, skipped: 0, byPose: {} };
  }

  let added = 0;
  let skipped = 0;
  const byPose: Record<string, number> = {};

  for (const e of entries) {
    if (!e.isDirectory() || !e.name.endsWith("_release")) continue;
    const relDir = path.join(outDir, e.name);
    let files: string[];
    try {
      files = fs.readdirSync(relDir).filter((f) => IMAGE_EXT.test(f));
    } catch {
      continue;
    }
    for (const f of files) {
      let buf: Buffer;
      try {
        buf = fs.readFileSync(path.join(relDir, f));
      } catch {
        continue;
      }
      const pose = poseGroupName(f);
      const ext = f.split(".").pop()!.toLowerCase();
      const res = await addImageFromBuffer(pose, buf, ext);
      if (!res) {
        skipped++;
      } else if (res.created) {
        added++;
        byPose[pose] = (byPose[pose] ?? 0) + 1;
      } else {
        skipped++;
      }
    }
  }

  return { added, skipped, byPose };
}

/**
 * グループの全画像を ComfyUI の input フォルダへアップロードし、割り当てられた
 * ファイル名の配列を返す。ローカル/リモートどちらの ComfyUI でも動く
 * (app/api/comfy/upload/route.ts と同じ /upload/image を使う)。
 */
export async function stageGroupToComfy(group: string): Promise<string[]> {
  const rels = listGroupImages(group);
  const base = getComfyUIUrl();
  const names = await Promise.all(
    rels.map(async (rel) => {
      const img = readImage(rel);
      if (!img) return null;
      const hash = path.basename(rel).split(".")[0];
      const ext = rel.split(".").pop()!.toLowerCase();
      const form = new FormData();
      form.append(
        "image",
        new Blob([new Uint8Array(img.buffer)], { type: img.mime }),
        `i2i_${hash}.${ext}`,
      );
      form.append("type", "input");
      form.append("overwrite", "true");
      try {
        const res = await fetch(`${base}/upload/image`, { method: "POST", body: form });
        if (!res.ok) return null;
        const json = (await res.json()) as { name?: string };
        return json.name ?? null;
      } catch {
        return null;
      }
    }),
  );
  return names.filter((n): n is string => !!n);
}
