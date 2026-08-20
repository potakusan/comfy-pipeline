import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getOutputDir, safePath } from "@/lib/server/output-dir";

/**
 * POST /api/comfy/output/delete
 * Body: { paths: string[] }  — paths relative to COMFYUI_OUTPUT_DIR (files or
 * directories)
 *
 * Deletes each given path under this machine's local COMFYUI_OUTPUT_DIR.
 * Always operates on whichever machine receives the request — when called
 * against a remote instance (REMOTE_PROCESS_URL), it deletes on that remote
 * machine. Used by save-remote/route.ts and process/sync/route.ts to remove
 * the host-side copy once a file has been confirmed saved on this side
 * (issue #44: images should end up only on the local/coordinator side, not
 * left behind on the remote GPU host).
 */
export async function POST(req: NextRequest) {
  const { paths } = (await req.json()) as { paths: string[] };
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const outputDir = getOutputDir();
  let deleted = 0;
  for (const relPath of paths) {
    const fullPath = safePath(outputDir, relPath);
    if (!fullPath) continue;
    try {
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        deleted++;
      }
    } catch {
      // best-effort; continue with remaining paths
    }
  }

  return NextResponse.json({ deleted });
}
