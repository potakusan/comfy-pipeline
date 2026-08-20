import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getOutputDir, safePath } from "@/lib/server/output-dir";
import { getRemoteProcessUrl } from "@/lib/setup/config";

/**
 * POST /api/process/sync
 * Body: { folder: string, sub: string }
 *
 * Fetches processed images from the remote machine and saves them to the local
 * COMFYUI_OUTPUT_DIR, preserving the folder structure:
 *   COMFYUI_OUTPUT_DIR / folder / sub / filename
 *
 * Uses existing remote endpoints:
 *   GET REMOTE/api/comfy/output?subfolder=folder/sub  → file list
 *   GET REMOTE/api/comfy/output/image?path=folder/sub/file → raw image bytes
 */
export async function POST(req: NextRequest) {
  const remoteUrl = getRemoteProcessUrl();
  if (!remoteUrl) {
    return NextResponse.json(
      { error: "REMOTE_PROCESS_URL not configured" },
      { status: 400 },
    );
  }

  const { folder, sub } = await req.json();
  if (!folder || !sub) {
    return NextResponse.json(
      { error: "folder and sub are required" },
      { status: 400 },
    );
  }

  // 1. Get file list from remote
  const listRes = await fetch(
    `${remoteUrl}/api/comfy/output?subfolder=${encodeURIComponent(`${folder}/${sub}`)}`,
  );
  if (!listRes.ok) {
    return NextResponse.json(
      { error: "Failed to list remote files" },
      { status: 502 },
    );
  }
  const { files } = (await listRes.json()) as { files: string[] };
  if (!files || files.length === 0) {
    return NextResponse.json({ saved: 0, skipped: 0 });
  }

  // 2. Prepare local destination directory
  const outputDir = getOutputDir();
  const localDir = safePath(outputDir, path.join(folder, sub));
  if (!localDir) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  fs.mkdirSync(localDir, { recursive: true });

  // 3. Download each file and save locally
  let saved = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const filename of files) {
    const localPath = path.join(localDir, path.basename(filename));
    // Skip if already exists (idempotent)
    if (fs.existsSync(localPath)) {
      skipped++;
      continue;
    }
    try {
      const imgRes = await fetch(
        `${remoteUrl}/api/comfy/output/image?path=${encodeURIComponent(`${folder}/${sub}/${filename}`)}`,
      );
      if (!imgRes.ok) {
        errors.push(filename);
        continue;
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(localPath, buf);
      saved++;
    } catch {
      errors.push(filename);
    }
  }

  // ローカルへの保存を確認できたファイル(新規保存+既存スキップ分)のみ、
  // リモート(ホスト)側の処理結果を削除する(issue #44)。
  const confirmedFiles = files.filter((f) => !errors.includes(f));
  if (confirmedFiles.length > 0) {
    fetch(`${remoteUrl}/api/comfy/output/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paths: confirmedFiles.map((f) => `${folder}/${sub}/${f}`),
      }),
    }).catch(() => {});
  }

  // 出力側が全件同期できた場合のみ、アップロード機能で転送した生画像の原本
  // (folder/直下、mosaic・resizedサブフォルダは含まない)も削除する。
  if (errors.length === 0) {
    fetch(`${remoteUrl}/api/comfy/output?subfolder=${encodeURIComponent(folder)}`)
      .then((res) => (res.ok ? res.json() : { files: [] }))
      .then(({ files: rawFiles }: { files?: string[] }) => {
        if (!rawFiles || rawFiles.length === 0) return;
        return fetch(`${remoteUrl}/api/comfy/output/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paths: rawFiles.map((f) => `${folder}/${f}`),
          }),
        });
      })
      .catch(() => {});
  }

  return NextResponse.json({
    saved,
    skipped,
    total: files.length,
    errors: errors.length > 0 ? errors : undefined,
    localPath: localDir,
  });
}
