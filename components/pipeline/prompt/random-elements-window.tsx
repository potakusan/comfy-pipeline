"use client";
import { useMemo } from "react";
import {
  type QueueItem,
  type Preset,
  type RandomChoice,
  isCommentLine,
  extractVariableNames,
} from "@/lib/comfy";
import { Badge } from "@/components/ui/badge";
import { Dices } from "lucide-react";
import FloatingWindow from "@/components/gallery/floating-window";
import { slotLabel } from "@/hooks/pipeline/use-variable-bindings";
import type { PromptPreviewPos } from "@/hooks/pipeline/use-pipeline";

interface RandomElementsWindowProps {
  queue: QueueItem[];
  /** 実行中バッチで採用された抽選(running アイテムのライブ表示用) */
  currentChoices: RandomChoice[];
  pos: PromptPreviewPos;
  onPosChange: (p: PromptPreviewPos) => void;
}

interface Source {
  source: string;
  options: string[];
}

function presetLines(p: Preset): string[] {
  return p.prompt.split("\n").filter((s) => s.trim() && !isCommentLine(s));
}

/** アイテムが持つランダム要素(抽選元と全候補)を静的に列挙する。 */
function itemSources(item: QueueItem): Source[] {
  const out: Source[] = [];
  const bp = item.batchPresets;
  const presets: Preset[] = [
    ...bp.selectedPhysicals,
    ...(bp.selectedCount ? [bp.selectedCount] : []),
    ...(bp.selectedPose ? [bp.selectedPose] : []),
    ...(bp.selectedScene ? [bp.selectedScene] : []),
    ...bp.selectedOthers,
  ];
  for (const p of presets) {
    if (p.promptMode === "random") {
      out.push({ source: `${slotLabel(p.type)}: ${p.name}`, options: presetLines(p) });
    }
  }
  if (item.additionalPromptMode === "random" && item.additionalPromptLines.length > 1) {
    out.push({ source: "追加プロンプト", options: item.additionalPromptLines });
  }
  if (item.variationTags.length > 1) {
    out.push({ source: "ランダム構図", options: item.variationTags });
  }
  const defs = item.variableDefs ?? {};
  for (const name of extractVariableNames(item.positivePrompt)) {
    if (defs[name]?.mode === "random") {
      out.push({ source: `%%${name}%%`, options: defs[name].candidates ?? [] });
    }
  }
  return out;
}

export default function RandomElementsWindow({
  queue,
  currentChoices,
  pos,
  onPosChange,
}: RandomElementsWindowProps) {
  const rows = useMemo(() => {
    const running = queue.find((i) => i.status === "running");
    const items = queue.filter(
      (i) =>
        i.status === "running" ||
        i.status === "pending" ||
        i.status === "completed",
    );
    return items
      .map((item) => {
        const sources = itemSources(item);
        if (sources.length === 0) return null;
        const picks = new Map<string, string>();
        const recorded =
          item.id === running?.id && currentChoices.length > 0
            ? currentChoices
            : (item.completedImages.at(-1)?.randomChoices ?? []);
        for (const c of recorded) picks.set(c.source, c.picked);
        return {
          id: item.id,
          label: item.label,
          status: item.status,
          sources: sources.map((s) => ({ ...s, picked: picks.get(s.source) ?? null })),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [queue, currentChoices]);

  if (rows.length === 0) return null;

  return (
    <FloatingWindow
      title="ランダム要素"
      icon={<Dices className="h-3 w-3 text-muted-foreground" />}
      badges={
        <Badge variant="secondary" className="text-[9px]">
          {rows.length}
        </Badge>
      }
      pos={pos}
      onPosChange={onPosChange}
      defaultWidth={340}
      defaultHeight={320}
      minWidth={240}
      minHeight={160}
      initialPlacement="bottom-right"
    >
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="truncate text-[11px] font-semibold">{r.label}</span>
              <Badge
                variant={r.status === "running" ? "default" : "outline"}
                className="shrink-0 text-[9px]"
              >
                {r.status === "running"
                  ? "実行中"
                  : r.status === "pending"
                    ? "待機"
                    : "完了"}
              </Badge>
            </div>
            <div className="space-y-0.5">
              {r.sources.map((s) => (
                <div
                  key={s.source}
                  className="flex cursor-help items-baseline gap-1.5 text-[10px]"
                  title={
                    s.options.length
                      ? `候補 (${s.options.length}):\n${s.options.join("\n")}`
                      : "候補なし"
                  }
                >
                  <span className="shrink-0 text-muted-foreground">
                    {s.source}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                    {s.picked ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </FloatingWindow>
  );
}
