import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getOutputDir(): string {
  return (
    process.env.COMFYUI_OUTPUT_DIR ||
    path.join(process.cwd(), "..", "ComfyUI", "output")
  );
}

/** POST /api/process/receive-folder
 *  Accepts multipart FormData with fields:
 *    folderName: string
 *    file: File (multiple)
 *  Saves files to COMFYUI_OUTPUT_DIR/{folderName}/.
 *  Called by the local machine's upload-to-remote route.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const folderName = formData.get("folderName") as string;
  if (!folderName) {
    return NextResponse.json({ error: "folderName required" }, { status: 400 });
  }

  const outputDir = getOutputDir();
  const targetDir = path.resolve(outputDir, folderName);
  if (!targetDir.startsWith(path.resolve(outputDir))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const files = formData.getAll("file") as File[];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(targetDir, file.name), buffer);
  }

  return NextResponse.json({ folder: folderName, count: files.length });
}
