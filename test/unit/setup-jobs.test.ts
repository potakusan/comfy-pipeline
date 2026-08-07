import { describe, expect, it } from "vitest";
import {
  appendSetupLog,
  createSetupJob,
  getSetupJob,
  updateSetupJob,
  updateSetupStep,
} from "@/lib/setup-jobs";

function uniqueId() {
  return `job-${Math.random().toString(36).slice(2)}`;
}

describe("setup-jobs", () => {
  it("creates a pending job with each step initialized to an empty log", () => {
    const id = uniqueId();
    const job = createSetupJob(id, [
      { id: "python", label: "Python", status: "pending" },
      { id: "git", label: "Git", status: "pending" },
    ]);

    expect(job.status).toBe("pending");
    expect(job.steps).toEqual([
      { id: "python", label: "Python", status: "pending", log: [] },
      { id: "git", label: "Git", status: "pending", log: [] },
    ]);
    expect(getSetupJob(id)).toEqual(job);
  });

  it("updateSetupStep updates only the targeted step, leaving others untouched", () => {
    const id = uniqueId();
    createSetupJob(id, [
      { id: "python", label: "Python", status: "pending" },
      { id: "git", label: "Git", status: "pending" },
    ]);

    updateSetupStep(id, "python", { status: "ok", error: undefined });

    const job = getSetupJob(id);
    expect(job?.steps.find((s) => s.id === "python")?.status).toBe("ok");
    expect(job?.steps.find((s) => s.id === "git")?.status).toBe("pending");
  });

  it("updateSetupStep is a no-op when the job id doesn't exist", () => {
    expect(() => updateSetupStep("missing-job", "python", { status: "ok" })).not.toThrow();
  });

  it("appendSetupLog appends to the targeted step's log and trims to the last 151 lines (150 retained + the newly appended one)", () => {
    const id = uniqueId();
    createSetupJob(id, [{ id: "python", label: "Python", status: "pending" }]);

    for (let i = 0; i < 155; i++) appendSetupLog(id, "python", `line ${i}`);

    const log = getSetupJob(id)?.steps[0].log ?? [];
    expect(log.length).toBe(151);
    expect(log[0]).toBe("line 4");
    expect(log[log.length - 1]).toBe("line 154");
  });

  it("appendSetupLog leaves other steps' logs untouched", () => {
    const id = uniqueId();
    createSetupJob(id, [
      { id: "python", label: "Python", status: "pending" },
      { id: "git", label: "Git", status: "pending" },
    ]);

    appendSetupLog(id, "python", "hello");

    expect(getSetupJob(id)?.steps.find((s) => s.id === "git")?.log).toEqual([]);
  });

  it("updateSetupJob merges top-level job fields such as status", () => {
    const id = uniqueId();
    createSetupJob(id, [{ id: "python", label: "Python", status: "pending" }]);

    updateSetupJob(id, { status: "completed", finishedAt: 12345 });

    expect(getSetupJob(id)).toMatchObject({ status: "completed", finishedAt: 12345 });
  });
});
