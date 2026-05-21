import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getOutputDir(): string {
  return (
    process.env.COMFYUI_OUTPUT_DIR ||
    path.join(process.cwd(), "..", "ComfyUI", "output")
  );
}

const IMAGE_EXT = /\.(png|jpe?g|webp|avif|bmp)$/i;

/** POST /api/process/upload-to-remote
 *  Body: { folder: string }
 *  Reads images from local COMFYUI_OUTPUT_DIR/{folder}/ and uploads them
 *  to REMOTE_PROCESS_URL/api/process/receive-folder as multipart FormData.
 */
export async function POST(req: NextRequest) {
  const { folder } = await req.json();

  const remoteUrl = process.env.REMOTE_PROCESS_URL;
  if (!remoteUrl) {
    return NextResponse.json(
      { error: "REMOTE_PROCESS_URL not configured" },
      { status: 400 },
    );
  }
  if (!folder) {
    return NextResponse.json({ error: "folder required" }, { status: 400 });
  }

  const outputDir = getOutputDir();
  const folderPath = path.resolve(outputDir, folder);
  if (!folderPath.startsWith(path.resolve(outputDir))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  let files: string[];
  try {
    files = fs.readdirSync(folderPath).filter((f) => IMAGE_EXT.test(f));
  } catch {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const formData = new FormData();
  formData.append("folderName", folder);
  for (const filename of files) {
    const buffer = fs.readFileSync(path.join(folderPath, filename));
    formData.append("file", new Blob([buffer]), filename);
  }

  const res = await fetch(`${remoteUrl}/api/process/receive-folder`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Remote error: ${text}` },
      { status: 502 },
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
