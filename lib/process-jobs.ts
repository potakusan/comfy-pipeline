export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface ProcessJob {
  id: string;
  status: JobStatus;
  total: number;
  current: number;
  log: string[];
  processedImages: string[]; // basenames in processing order
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

// Module-level store (shared across API route handlers in the same process)
const jobs = new Map<string, ProcessJob>();

export function createJob(id: string, total: number): ProcessJob {
  const job: ProcessJob = {
    id,
    status: "pending",
    total,
    current: 0,
    log: [],
    processedImages: [],
    startedAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): ProcessJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, updates: Partial<ProcessJob>): void {
  const job = jobs.get(id);
  if (job) jobs.set(id, { ...job, ...updates });
}

export function appendLog(id: string, line: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.log = [...job.log.slice(-200), line]; // keep last 200 lines
  jobs.set(id, job);
}

export function incrementProgress(id: string): void {
  const job = jobs.get(id);
  if (!job) return;
  jobs.set(id, { ...job, current: job.current + 1 });
}

export function addProcessedImage(id: string, filename: string): void {
  const job = jobs.get(id);
  if (!job) return;
  jobs.set(id, { ...job, processedImages: [...job.processedImages, filename] });
}
