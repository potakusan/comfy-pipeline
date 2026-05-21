import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/process-jobs";

/** GET /api/process/status/:jobId */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (jobId.startsWith("remote:")) {
    const remoteUrl = process.env.REMOTE_PROCESS_URL;
    if (!remoteUrl) return NextResponse.json({ error: "Remote URL not configured" }, { status: 500 });
    const actualJobId = jobId.slice("remote:".length);
    const res = await fetch(`${remoteUrl}/api/process/status/${actualJobId}`);
    if (!res.ok) return NextResponse.json({ error: "Remote job not found" }, { status: 404 });
    const data = await res.json();
    // Keep the remote: prefix as the job id so the client keeps routing here
    return NextResponse.json({ ...data, id: jobId });
  }

  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json(job);
}
