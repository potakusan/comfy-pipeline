export type SetupStepStatus = "pending" | "running" | "ok" | "failed" | "skipped"

export interface SetupStep {
  id: string
  label: string
  status: SetupStepStatus
  log: string[]
  error?: string
}

export interface SetupJob {
  id: string
  status: "pending" | "running" | "completed" | "failed"
  steps: SetupStep[]
  startedAt: number
  finishedAt?: number
}

// Use globalThis so hot-reload doesn't wipe the map (and orphan already-spawned
// subprocesses from tracking) in dev, matching lib/download-jobs.ts.
const g = globalThis as typeof globalThis & { __setupJobs?: Map<string, SetupJob> }
if (!g.__setupJobs) g.__setupJobs = new Map()
const jobs = g.__setupJobs

// Long-running server process: evict jobs that have lingered past their
// useful life so per-step `log` arrays don't accumulate forever.
const JOB_TTL_MS = 6 * 60 * 60 * 1000 // 6時間

function evictStaleJobs(): void {
  const cutoff = Date.now() - JOB_TTL_MS
  for (const [id, job] of jobs) {
    if (job.startedAt < cutoff) jobs.delete(id)
  }
}

export function createSetupJob(id: string, steps: Omit<SetupStep, "log">[]): SetupJob {
  evictStaleJobs()
  const job: SetupJob = {
    id,
    status: "pending",
    steps: steps.map((s) => ({ ...s, log: [] })),
    startedAt: Date.now(),
  }
  jobs.set(id, job)
  return job
}

export function getSetupJob(id: string): SetupJob | undefined {
  return jobs.get(id)
}

export function updateSetupJob(id: string, updates: Partial<Omit<SetupJob, "steps">>): void {
  const job = jobs.get(id)
  if (job) jobs.set(id, { ...job, ...updates })
}

export function updateSetupStep(jobId: string, stepId: string, updates: Partial<SetupStep>): void {
  const job = jobs.get(jobId)
  if (!job) return
  const steps = job.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
  jobs.set(jobId, { ...job, steps })
}

export function appendSetupLog(jobId: string, stepId: string, line: string): void {
  const job = jobs.get(jobId)
  if (!job) return
  const steps = job.steps.map((s) =>
    s.id === stepId ? { ...s, log: [...s.log.slice(-150), line] } : s,
  )
  jobs.set(jobId, { ...job, steps })
}
