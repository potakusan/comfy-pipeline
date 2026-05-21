import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getOutputDir(): string {
  return (
    process.env.COMFYUI_OUTPUT_DIR ||
    path.join(process.cwd(), "..", "ComfyUI", "output")
  );
}

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
  const remoteUrl = process.env.REMOTE_PROCESS_URL;
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
  const localDir = path.join(getOutputDir(), folder, sub);
  fs.mkdirSync(localDir, { recursive: true });

  // 3. Download each file and save locally
  let saved = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const filename of files) {
    const localPath = path.join(localDir, filename);
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

  return NextResponse.json({
    saved,
    skipped,
    total: files.length,
    errors: errors.length > 0 ? errors : undefined,
    localPath: localDir,
  });
}
