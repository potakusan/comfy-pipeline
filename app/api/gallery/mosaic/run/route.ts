import { NextRequest, NextResponse } from "next/server";
import { startProcessRun, type RunRequest } from "@/lib/process-run";
import type { MosaicConfigValue } from "@/components/mosaic-config";

const DEFAULT_GALLERY_RESIZE = { scalePercent: 40, quality: 92 };

/** POST /api/gallery/mosaic/run
 *  Body: { folder: string, mosaic: MosaicConfigValue, resize?: { scalePercent: number, quality: number } }
 *  Thin wrapper around the shared /process pipeline (lib/process-run.ts).
 *  Resize always runs (before mosaic, same order as /process); scalePercent
 *  defaults to 40% if the caller doesn't specify one. Poll progress via the
 *  existing GET /api/process/status/:jobId (jobId returned here works with
 *  it as-is).
 */
export async function POST(req: NextRequest) {
  const { folder, mosaic, resize } = (await req.json()) as {
    folder: string;
    mosaic: MosaicConfigValue;
    resize?: { scalePercent: number; quality: number };
  };
  if (!folder) return NextResponse.json({ error: "folder required" }, { status: 400 });

  const body: RunRequest = {
    folder,
    mosaic: { ...mosaic, enabled: true },
    resize: { enabled: true, ...DEFAULT_GALLERY_RESIZE, ...resize },
  };

  const result = await startProcessRun(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
