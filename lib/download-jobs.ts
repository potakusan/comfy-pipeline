export type DownloadStatus = 'pending' | 'downloading' | 'done' | 'error';

export interface DownloadJob {
  id: string;
  type: 'lora' | 'checkpoint';
  fileName: string;
  modelName: string;
  status: DownloadStatus;
  progress: number;
  totalBytes: number;
  downloadedBytes: number;
  error?: string;
  startedAt: number;
}

// Use globalThis so hot-reload doesn't wipe the map in dev
const g = globalThis as typeof globalThis & { __dlJobs?: Map<string, DownloadJob> };
if (!g.__dlJobs) g.__dlJobs = new Map();
const jobs = g.__dlJobs;

// Long-running server process: evict jobs that have lingered past their
// useful life so the map doesn't accumulate forever.
const JOB_TTL_MS = 6 * 60 * 60 * 1000; // 6時間

function evictStaleJobs(): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.startedAt < cutoff) jobs.delete(id);
  }
}

export function createJob(
  data: Pick<DownloadJob, 'type' | 'fileName' | 'modelName'>,
): DownloadJob {
  evictStaleJobs();
  const id = crypto.randomUUID();
  const job: DownloadJob = {
    ...data,
    id,
    status: 'pending',
    progress: 0,
    totalBytes: 0,
    downloadedBytes: 0,
    startedAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): DownloadJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, update: Partial<DownloadJob>): void {
  const job = jobs.get(id);
  if (job) jobs.set(id, { ...job, ...update });
}
