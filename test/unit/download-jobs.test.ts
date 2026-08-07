import { describe, expect, it } from "vitest";
import { createJob, getJob, updateJob } from "@/lib/download-jobs";

describe("download-jobs", () => {
  it("creates a pending job with a generated id and zeroed byte counters", () => {
    const job = createJob({ type: "lora", fileName: "a.safetensors", modelName: "Model A" });

    expect(job.id).toBeTruthy();
    expect(job).toMatchObject({
      type: "lora",
      fileName: "a.safetensors",
      modelName: "Model A",
      status: "pending",
      progress: 0,
      totalBytes: 0,
      downloadedBytes: 0,
    });
    expect(getJob(job.id)).toEqual(job);
  });

  it("assigns distinct ids to jobs created back-to-back", () => {
    const jobA = createJob({ type: "checkpoint", fileName: "a.safetensors", modelName: "A" });
    const jobB = createJob({ type: "checkpoint", fileName: "b.safetensors", modelName: "B" });

    expect(jobA.id).not.toBe(jobB.id);
  });

  it("updateJob merges progress updates", () => {
    const job = createJob({ type: "lora", fileName: "a.safetensors", modelName: "A" });

    updateJob(job.id, { status: "downloading", progress: 42, downloadedBytes: 420, totalBytes: 1000 });

    expect(getJob(job.id)).toMatchObject({
      status: "downloading",
      progress: 42,
      downloadedBytes: 420,
      totalBytes: 1000,
    });
  });
});
