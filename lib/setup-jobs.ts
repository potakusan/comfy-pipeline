import { createJobStore } from "./server/job-store"

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

const store = createJobStore<SetupJob>("__setupJobs")

export function createSetupJob(id: string, steps: Omit<SetupStep, "log">[]): SetupJob {
  return store.create({
    id,
    status: "pending",
    steps: steps.map((s) => ({ ...s, log: [] })),
    startedAt: Date.now(),
  })
}

export function getSetupJob(id: string): SetupJob | undefined {
  return store.get(id)
}

export function updateSetupJob(id: string, updates: Partial<Omit<SetupJob, "steps">>): void {
  store.update(id, updates)
}

export function updateSetupStep(jobId: string, stepId: string, updates: Partial<SetupStep>): void {
  const job = store.get(jobId)
  if (!job) return
  const steps = job.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
  store.update(jobId, { steps })
}

export function appendSetupLog(jobId: string, stepId: string, line: string): void {
  const job = store.get(jobId)
  if (!job) return
  const steps = job.steps.map((s) =>
    s.id === stepId ? { ...s, log: [...s.log.slice(-150), line] } : s,
  )
  store.update(jobId, { steps })
}
