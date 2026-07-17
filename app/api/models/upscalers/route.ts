import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUpscalerDir } from "@/lib/setup/config";

const MODEL_EXTS = [".pth", ".pt", ".safetensors", ".ckpt"];
// Only scan these subdirectories
const ALLOWED_SUBDIRS = ["ESRGAN", "RealESRGAN"];

export async function GET() {
  const UPSCALER_DIR = getUpscalerDir();
  if (!UPSCALER_DIR) {
    return NextResponse.json(
      { error: "COMFYUI_UPSCALER_DIR not configured" },
      { status: 500 },
    );
  }
  try {
    const items: { fileName: string; name: string }[] = [];
    for (const subdir of ALLOWED_SUBDIRS) {
      const dir = path.join(UPSCALER_DIR, subdir);
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = MODEL_EXTS.find((e) => entry.name.endsWith(e));
        if (!ext) continue;
        const name = entry.name.slice(0, -ext.length);
        items.push({ fileName: entry.name, name });
      }
    }
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
