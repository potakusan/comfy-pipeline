import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/models/download-jobs';
import { getRemoteProcessUrl } from '@/lib/setup/config';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const remoteUrl = getRemoteProcessUrl();
  if (remoteUrl && jobId.startsWith('remote:')) {
    const realJobId = jobId.slice('remote:'.length);
    const res = await fetch(`${remoteUrl}/api/models/download/${realJobId}`);
    return NextResponse.json(await res.json(), { status: res.status });
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  return NextResponse.json(job);
}
