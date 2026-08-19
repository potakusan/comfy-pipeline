import { createJobStore } from "@/lib/server/job-store";
import type { TrainingJob } from "./types";

const store = createJobStore<TrainingJob>("__kohyaTrainJobs");

export function createTrainingJob(datasetFolder: string, outputName: string): TrainingJob {
  return store.create({
    id: crypto.randomUUID(),
    status: "pending",
    log: [],
    startedAt: Date.now(),
    datasetFolder,
    outputName,
  });
}

export function getTrainingJob(id: string): TrainingJob | undefined {
  return store.get(id);
}

export function updateTrainingJob(id: string, updates: Partial<TrainingJob>): void {
  store.update(id, updates);
}

export function appendTrainingLog(id: string, line: string): void {
  store.appendToLog(id, "log", line, 300);
}
