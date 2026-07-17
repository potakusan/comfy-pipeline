// Client-side helpers for talking to the local ComfyPipeline API routes
// (which in turn proxy to ComfyUI). Shared between the queue engine
// (hooks/use-pipeline.ts) and the gallery regenerate flow (hooks/use-gallery.ts).

export async function submitPromptHttp(
  workflow: Record<string, unknown>,
  clientId: string,
): Promise<string> {
  const res = await fetch("/api/comfy/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.prompt_id as string;
}

export async function listOutputFiles(subfolder: string): Promise<string[]> {
  try {
    const res = await fetch(
      `/api/comfy/output?subfolder=${encodeURIComponent(subfolder)}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.files || []) as string[];
  } catch {
    return [];
  }
}

export async function pollForCompletion(
  promptId: string,
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    await new Promise((r) => setTimeout(r, 1500));
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
