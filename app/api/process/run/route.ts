import { NextRequest, NextResponse } from "next/server";
import { startProcessRun, type RunRequest } from "@/lib/process/process-run";

export type { RunRequest };

/** POST /api/process/run
 *  Execution order: resize first (if enabled), then mosaic.
 *  This minimises I/O time because all heavy file I/O happens on smaller images.
 *  When REMOTE_PROCESS_URL is set, forwards the request to the remote machine.
 */
export async function POST(req: NextRequest) {
  const body: RunRequest = await req.json();
  const result = await startProcessRun(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
