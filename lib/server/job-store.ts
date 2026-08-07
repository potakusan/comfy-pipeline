const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6時間

/**
 * process-jobs.ts/download-jobs.ts/setup-jobs.tsで共通の
 * 「Map<id, T> + 生成/取得/部分更新 + TTLベースのeviction」パターンを
 * まとめたファクトリ。globalThis経由で保持するため、devのホットリロードで
 * 既にspawn済みのサブプロセスがトラッキングから孤立することもない。
 */
export function createJobStore<T extends { id: string; startedAt: number }>(
  globalKey: string,
  ttlMs: number = DEFAULT_TTL_MS,
) {
  const g = globalThis as unknown as Record<string, Map<string, T> | undefined>;
  if (!g[globalKey]) g[globalKey] = new Map<string, T>();
  const jobs = g[globalKey] as Map<string, T>;

  function evictStale(): void {
    const cutoff = Date.now() - ttlMs;
    for (const [id, job] of jobs) {
      if (job.startedAt < cutoff) jobs.delete(id);
    }
  }

  function create(job: T): T {
    evictStale();
    jobs.set(job.id, job);
    return job;
  }

  function get(id: string): T | undefined {
    return jobs.get(id);
  }

  function update(id: string, updates: Partial<T>): void {
    const job = jobs.get(id);
    if (job) jobs.set(id, { ...job, ...updates });
  }

  /** T上のstring[]フィールドへ1行追記し、直近keepLast行を超えた古い行を捨てる。 */
  function appendToLog(id: string, field: keyof T, line: string, keepLast: number): void {
    const job = jobs.get(id);
    if (!job) return;
    const current = job[field] as unknown as string[];
    const next = [...current.slice(-keepLast), line];
    jobs.set(id, { ...job, [field]: next });
  }

  return { create, get, update, appendToLog };
}
