import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/models/download-jobs';
import { getRemoteProcessUrl } from '@/lib/setup/config';
import { proxyJson } from '@/lib/server/remote-proxy';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const remoteUrl = getRemoteProcessUrl();
  if (remoteUrl && jobId.startsWith('remote:')) {
    const realJobId = jobId.slice('remote:'.length);
    return proxyJson(remoteUrl, `/api/models/download/${realJobId}`);
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  return NextResponse.json(job);
}
