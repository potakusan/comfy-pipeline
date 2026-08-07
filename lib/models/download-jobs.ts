import { createJobStore } from "../server/job-store";

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

const store = createJobStore<DownloadJob>('__dlJobs');

export function createJob(
  data: Pick<DownloadJob, 'type' | 'fileName' | 'modelName'>,
): DownloadJob {
  const id = crypto.randomUUID();
  return store.create({
    ...data,
    id,
    status: 'pending',
    progress: 0,
    totalBytes: 0,
    downloadedBytes: 0,
    startedAt: Date.now(),
  });
}

export function getJob(id: string): DownloadJob | undefined {
  return store.get(id);
}

export function updateJob(id: string, update: Partial<DownloadJob>): void {
  store.update(id, update);
}
