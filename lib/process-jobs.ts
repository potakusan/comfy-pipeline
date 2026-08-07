export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface MosaicImageResult {
  /** Original file's basename. */
  filename: string;
  /** Detected/mosaiced region count. 0 = no target found. */
  regionCount: number;
  /** Path (relative to outputDir) of the actually-saved output file, parsed
   * from automosaic.py's log — never guessed from a naming convention, since
   * automosaic.py appends a numeric suffix on filename collisions. */
  outputPath: string | null;
}

export interface ProcessJob {
  id: string;
  status: JobStatus;
  total: number;
  current: number;
  log: string[];
  processedImages: string[]; // basenames in processing order
  results: MosaicImageResult[]; // per-image mosaic outcome, populated by the mosaic stage only
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

// Use globalThis so hot-reload doesn't wipe the map (and orphan already-spawned
// subprocesses from tracking) in dev, matching lib/download-jobs.ts.
const g = globalThis as typeof globalThis & { __processJobs?: Map<string, ProcessJob> };
if (!g.__processJobs) g.__processJobs = new Map();
const jobs = g.__processJobs;

// Long-running server process: evict jobs that have lingered past their
// useful life so `log`/`processedImages`/`results` don't accumulate forever.
const JOB_TTL_MS = 6 * 60 * 60 * 1000; // 6時間

function evictStaleJobs(): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.startedAt < cutoff) jobs.delete(id);
  }
}

export function createJob(id: string, total: number): ProcessJob {
  evictStaleJobs();
  const job: ProcessJob = {
    id,
    status: "pending",
    total,
    current: 0,
    log: [],
    processedImages: [],
    results: [],
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

export function addMosaicResult(id: string, result: MosaicImageResult): void {
  const job = jobs.get(id);
  if (!job) return;
  jobs.set(id, { ...job, results: [...job.results, result] });
}
