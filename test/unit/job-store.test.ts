import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJobStore } from "@/lib/server/job-store";

interface TestJob {
  id: string;
  startedAt: number;
  log: string[];
  count: number;
}

const GLOBAL_KEY = "__testJobStore";

function cleanupGlobal() {
  delete (globalThis as unknown as Record<string, unknown>)[GLOBAL_KEY];
}

beforeEach(cleanupGlobal);
afterEach(() => {
  cleanupGlobal();
  vi.useRealTimers();
});

describe("createJobStore", () => {
  it("creates and retrieves jobs by id", () => {
    const store = createJobStore<TestJob>(GLOBAL_KEY);
    const job = store.create({ id: "job1", startedAt: Date.now(), log: [], count: 0 });

    expect(store.get("job1")).toEqual(job);
    expect(store.get("missing")).toBeUndefined();
  });

  it("merges partial updates without touching untouched fields", () => {
    const store = createJobStore<TestJob>(GLOBAL_KEY);
    store.create({ id: "job1", startedAt: Date.now(), log: [], count: 0 });

    store.update("job1", { count: 5 });

    expect(store.get("job1")).toMatchObject({ id: "job1", count: 5, log: [] });
  });

  it("silently ignores updates to a job id that doesn't exist", () => {
    const store = createJobStore<TestJob>(GLOBAL_KEY);
    expect(() => store.update("missing", { count: 5 })).not.toThrow();
    expect(store.get("missing")).toBeUndefined();
  });

  it("persists the underlying Map across separate createJobStore calls with the same key", () => {
    const storeA = createJobStore<TestJob>(GLOBAL_KEY);
    storeA.create({ id: "job1", startedAt: Date.now(), log: [], count: 0 });

    const storeB = createJobStore<TestJob>(GLOBAL_KEY);
    expect(storeB.get("job1")).toBeDefined();
  });

  it("evicts jobs older than the TTL the next time create() runs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const store = createJobStore<TestJob>(GLOBAL_KEY, 1000);
    store.create({ id: "old", startedAt: Date.now(), log: [], count: 0 });

    vi.setSystemTime(5000); // well past the 1000ms TTL
    store.create({ id: "new", startedAt: Date.now(), log: [], count: 0 });

    expect(store.get("old")).toBeUndefined();
    expect(store.get("new")).toBeDefined();
  });

  it("keeps jobs within the TTL window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const store = createJobStore<TestJob>(GLOBAL_KEY, 10_000);
    store.create({ id: "recent", startedAt: Date.now(), log: [], count: 0 });

    vi.setSystemTime(5000);
    store.create({ id: "another", startedAt: Date.now(), log: [], count: 0 });

    expect(store.get("recent")).toBeDefined();
    expect(store.get("another")).toBeDefined();
  });

  it("appendToLog keeps the last keepLast entries plus the newly appended one", () => {
    const store = createJobStore<TestJob>(GLOBAL_KEY);
    store.create({ id: "job1", startedAt: Date.now(), log: ["a", "b", "c"], count: 0 });

    store.appendToLog("job1", "log", "d", 2);

    expect(store.get("job1")?.log).toEqual(["b", "c", "d"]);
  });

  it("appendToLog is a no-op for a job id that doesn't exist", () => {
    const store = createJobStore<TestJob>(GLOBAL_KEY);
    expect(() => store.appendToLog("missing", "log", "line", 10)).not.toThrow();
  });
});
