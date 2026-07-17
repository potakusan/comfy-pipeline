import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getOutputDir, safePath } from "@/lib/server/output-dir";
import { releaseFolderName } from "@/lib/gallery";

function releaseTargetFor(outputDir: string, relPath: string): string | null {
  const parts = relPath.split("/");
  if (parts.length < 2) return null;
  const folder = parts[0];
  const rest = parts.slice(1).join("/");
  return safePath(outputDir, `${releaseFolderName(folder)}/${rest}`);
}

/** POST /api/gallery/release  Body: { paths: string[] }
 *  Copies each image (and its sidecar JSON, if present) into "<folder>_release/".
 *  Presence of the file there IS the "selected for release" state.
 */
export async function POST(req: NextRequest) {
  const outputDir = getOutputDir();
  const { paths } = (await req.json()) as { paths: string[] };
  if (!Array.isArray(paths)) return NextResponse.json({ error: "Missing paths" }, { status: 400 });

  let copied = 0;
  for (const relPath of paths) {
    const src = safePath(outputDir, relPath);
    const dest = releaseTargetFor(outputDir, relPath);
    if (!src || !dest || !fs.existsSync(src)) continue;
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      if (fs.existsSync(`${src}.json`)) fs.copyFileSync(`${src}.json`, `${dest}.json`);
      copied++;
    } catch {}
  }
  return NextResponse.json({ copied });
}

/** DELETE /api/gallery/release  Body: { paths: string[] }
 *  Removes the release-folder copies (deselects for release).
 */
export async function DELETE(req: NextRequest) {
  const outputDir = getOutputDir();
  const { paths } = (await req.json()) as { paths: string[] };
  if (!Array.isArray(paths)) return NextResponse.json({ error: "Missing paths" }, { status: 400 });

  let removed = 0;
  for (const relPath of paths) {
    const dest = releaseTargetFor(outputDir, relPath);
    if (!dest) continue;
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      if (fs.existsSync(`${dest}.json`)) fs.unlinkSync(`${dest}.json`);
      removed++;
    } catch {}
  }
  return NextResponse.json({ removed });
}
