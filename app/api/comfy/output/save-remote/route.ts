import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getOutputDir, safePath } from "@/lib/server/output-dir";
import { getRemoteProcessUrl } from "@/lib/setup/config";

/**
 * POST /api/comfy/output/save-remote
 * Body: { paths: string[] }  — paths relative to COMFYUI_OUTPUT_DIR, e.g. ["20250521-lora/out_00001_.png"]
 *
 * Downloads each file from the remote machine via /api/comfy/output/image
 * and saves it to the local COMFYUI_OUTPUT_DIR, preserving the folder structure.
 *
 * No-op if REMOTE_PROCESS_URL is not configured.
 */
export async function POST(req: NextRequest) {
  const remoteUrl = getRemoteProcessUrl();
  if (!remoteUrl) return NextResponse.json({ saved: 0 });

  const { paths } = (await req.json()) as { paths: string[] };
  if (!Array.isArray(paths) || paths.length === 0)
    return NextResponse.json({ saved: 0 });

  const outputDir = getOutputDir();
  let saved = 0;
  const confirmed: string[] = [];

  for (const relPath of paths) {
    const localFull = safePath(outputDir, relPath);
    if (!localFull) continue;
    // Skip if already on disk
    if (fs.existsSync(localFull)) { saved++; confirmed.push(relPath); continue; }

    try {
      const res = await fetch(
        `${remoteUrl}/api/comfy/output/image?path=${encodeURIComponent(relPath)}`,
      );
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(localFull), { recursive: true });
      fs.writeFileSync(localFull, buf);
      saved++;
      confirmed.push(relPath);
    } catch {
      // best-effort; next file continues
    }
  }

  // ローカルへの保存を確認できたファイルのみ、リモート(ホスト)側の原本を削除する
  // (issue #44: 画像はローカル側にのみ残し、ホスト側に残り続けないようにする)
  if (confirmed.length > 0) {
    fetch(`${remoteUrl}/api/comfy/output/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: confirmed }),
    }).catch(() => {});
  }

  return NextResponse.json({ saved });
}
