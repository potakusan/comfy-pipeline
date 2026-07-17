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

const jobs = new Map<string, SetupJob>()

export function createSetupJob(id: string, steps: Omit<SetupStep, "log">[]): SetupJob {
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
