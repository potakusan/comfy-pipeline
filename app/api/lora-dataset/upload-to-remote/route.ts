import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveDatasetDir } from "@/lib/lora-dataset/dataset-store";
import { getRemoteProcessUrl } from "@/lib/setup/config";

/** POST /api/lora-dataset/upload-to-remote
 *  Body: { folder: string }
 *  ローカルのLORA_DATASET_DIR/{folder}/ 内の全ファイル（画像+.txt+.json+_dataset.json）を
 *  REMOTE_PROCESS_URL/api/lora-dataset/receive-folder へmultipart FormDataでアップロードする。
 *  画像のみに絞る app/api/process/upload-to-remote とは異なり、キャプション・メタデータも送る。
 */
export async function POST(req: NextRequest) {
  const { folder } = await req.json();

  const remoteUrl = getRemoteProcessUrl();
  if (!remoteUrl) {
    return NextResponse.json({ error: "REMOTE_PROCESS_URL not configured" }, { status: 400 });
  }
  if (!folder) {
    return NextResponse.json({ error: "folder required" }, { status: 400 });
  }

  const dir = resolveDatasetDir(folder);
  if (!dir) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });

  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile());
  } catch {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const formData = new FormData();
  formData.append("folderName", folder);
  for (const filename of files) {
    const buffer = fs.readFileSync(path.join(dir, filename));
    formData.append("file", new Blob([buffer]), filename);
  }

  const res = await fetch(`${remoteUrl}/api/lora-dataset/receive-folder`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Remote error: ${text}` }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
