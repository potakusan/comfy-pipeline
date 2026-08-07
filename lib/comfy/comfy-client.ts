// Client-side helpers for talking to the local ComfyPipeline API routes
// (which in turn proxy to ComfyUI). Shared between the queue engine
// (hooks/use-pipeline.ts) and the gallery regenerate flow (hooks/use-gallery.ts).

export async function submitPromptHttp(
  workflow: Record<string, unknown>,
  clientId: string,
  signal?: AbortSignal,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/comfy/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
      signal,
    });
  } catch (e) {
    // Normalize to match pollForCompletion's cancellation signal so callers
    // can branch on a single "Cancelled" message regardless of which step aborted.
    if ((e as Error).name === "AbortError") throw new Error("Cancelled");
    throw e;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.prompt_id as string;
}

/** Throws on failure — callers that can tolerate a partial/best-effort listing
 * (e.g. scanning many folders) should catch per-call; callers that use the
 * result to detect newly-generated files must not treat a failed listing as
 * "no files", or a successful generation could go unrecorded. */
export async function listOutputFiles(subfolder: string): Promise<string[]> {
  const res = await fetch(
    `/api/comfy/output?subfolder=${encodeURIComponent(subfolder)}`,
  );
  if (!res.ok) throw new Error(`Failed to list output files (HTTP ${res.status})`);
  const data = await res.json();
  return (data.files || []) as string[];
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 20 * 60 * 1000; // 20分: 重い workflow でも打ち切れるよう上限を設ける

export async function pollForCompletion(
  promptId: string,
  signal: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (!signal.aborted) {
    if (Date.now() >= deadline) throw new Error("Generation timed out");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    if (signal.aborted) throw new Error("Cancelled");
    try {
      const res = await fetch(`/api/comfy/history?promptId=${promptId}`, {
        signal,
      });
      const data = await res.json();
      const item = data[promptId];
      if (item) {
        if (!item.status || item.status.status_str === "success") return;
        if (item.status.status_str === "error") {
          const msgs =
            (item.status.messages as string[][])?.flat().join(", ") ||
            "Generation failed";
          throw new Error(msgs);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new Error("Cancelled");
      if ((e as Error).message === "Cancelled") throw e;
      if ((e as Error).message.startsWith("Generation")) throw e;
    }
  }
  throw new Error("Cancelled");
}

/**
 * ワークフローを送信し完了をポーリングして、送信前後でoutputフォルダに
 * 新規追加されたファイル名の一覧を返す。use-pipeline.ts(バッチキュー)と
 * use-gallery.ts(単体再生成)で共通の「送信→ポーリング→新規ファイル差分」
 * コアロジック(前後のリトライループ/redo制御・成功後の後処理は
 * 呼び出し元ごとに異なるためここには含めない)。
 */
export async function submitAndAwaitNewFiles(
  workflow: Record<string, unknown>,
  folder: string,
  clientId: string,
  signal: AbortSignal,
): Promise<string[]> {
  const filesBefore = await listOutputFiles(folder);
  const promptId = await submitPromptHttp(workflow, clientId, signal);
  await pollForCompletion(promptId, signal);
  const filesAfter = await listOutputFiles(folder);
  return filesAfter.filter((f) => !filesBefore.includes(f));
}
