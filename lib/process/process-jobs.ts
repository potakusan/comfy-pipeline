import { createJobStore } from "../server/job-store";

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

const store = createJobStore<ProcessJob>("__processJobs");

export function createJob(id: string, total: number): ProcessJob {
  return store.create({
    id,
    status: "pending",
    total,
    current: 0,
    log: [],
    processedImages: [],
    results: [],
    startedAt: Date.now(),
  });
}

export function getJob(id: string): ProcessJob | undefined {
  return store.get(id);
}

export function updateJob(id: string, updates: Partial<ProcessJob>): void {
  store.update(id, updates);
}

export function appendLog(id: string, line: string): void {
  store.appendToLog(id, "log", line, 200); // keep last 200 lines
}

export function incrementProgress(id: string): void {
  const job = store.get(id);
  if (!job) return;
  store.update(id, { current: job.current + 1 });
}

export function addProcessedImage(id: string, filename: string): void {
  const job = store.get(id);
  if (!job) return;
  store.update(id, { processedImages: [...job.processedImages, filename] });
}

export function addMosaicResult(id: string, result: MosaicImageResult): void {
  const job = store.get(id);
  if (!job) return;
  store.update(id, { results: [...job.results, result] });
}
