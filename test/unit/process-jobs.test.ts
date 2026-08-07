import { describe, expect, it } from "vitest";
import {
  addMosaicResult,
  addProcessedImage,
  appendLog,
  createJob,
  getJob,
  incrementProgress,
  updateJob,
} from "@/lib/process-jobs";

function uniqueId() {
  return `job-${Math.random().toString(36).slice(2)}`;
}

describe("process-jobs", () => {
  it("creates a pending job with zeroed counters", () => {
    const id = uniqueId();
    const job = createJob(id, 10);

    expect(job).toMatchObject({ id, status: "pending", total: 10, current: 0, log: [] });
    expect(getJob(id)).toEqual(job);
  });

  it("incrementProgress advances current by 1 and is a no-op for unknown ids", () => {
    const id = uniqueId();
    createJob(id, 5);

    incrementProgress(id);
    incrementProgress(id);

    expect(getJob(id)?.current).toBe(2);
    expect(() => incrementProgress("missing-job")).not.toThrow();
  });

  it("addProcessedImage appends filenames in order", () => {
    const id = uniqueId();
    createJob(id, 5);

    addProcessedImage(id, "a.png");
    addProcessedImage(id, "b.png");

    expect(getJob(id)?.processedImages).toEqual(["a.png", "b.png"]);
  });

  it("addMosaicResult appends per-image results in order", () => {
    const id = uniqueId();
    createJob(id, 5);

    addMosaicResult(id, { filename: "a.png", regionCount: 2, outputPath: "out/a.png" });
    addMosaicResult(id, { filename: "b.png", regionCount: 0, outputPath: null });

    expect(getJob(id)?.results).toEqual([
      { filename: "a.png", regionCount: 2, outputPath: "out/a.png" },
      { filename: "b.png", regionCount: 0, outputPath: null },
    ]);
  });

  it("appendLog keeps only the most recent 201 lines (200 retained + the newly appended one)", () => {
    const id = uniqueId();
    createJob(id, 5);

    for (let i = 0; i < 205; i++) appendLog(id, `line ${i}`);

    const log = getJob(id)?.log ?? [];
    expect(log.length).toBe(201);
    expect(log[0]).toBe("line 4");
    expect(log[log.length - 1]).toBe("line 204");
  });

  it("updateJob merges partial fields, e.g. transitioning status to failed with an error", () => {
    const id = uniqueId();
    createJob(id, 5);

    updateJob(id, { status: "failed", error: "boom" });

    expect(getJob(id)).toMatchObject({ status: "failed", error: "boom", total: 5 });
  });
});
