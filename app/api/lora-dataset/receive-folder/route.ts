import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ensureDatasetDir } from "@/lib/lora-dataset/dataset-store";

/** POST /api/lora-dataset/receive-folder
 *  Accepts multipart FormData with fields:
 *    folderName: string ("<repeat>_<name>")
 *    file: File (multiple)
 *  Saves files to LORA_DATASET_DIR/{folderName}/. upload-to-remote から呼ばれる。
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const folderName = formData.get("folderName") as string;
  if (!folderName) {
    return NextResponse.json({ error: "folderName required" }, { status: 400 });
  }

  const targetDir = ensureDatasetDir(folderName);
  if (!targetDir) {
    return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
  }

  const files = formData.getAll("file") as File[];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(targetDir, path.basename(file.name)), buffer);
  }

  return NextResponse.json({ folder: folderName, count: files.length });
}
