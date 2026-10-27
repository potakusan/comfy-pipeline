"use client";
import { useMemo, useState } from "react";
import {
  type BatchPresetSet,
  type BatchRunOverrides,
  type GenerationSettings,
  type LoraEntry,
  type Preset,
  type PromptReplacement,
  type SeedRecipeGroup,
  buildRecipeSet,
  mergePresetsWithSnapshot,
} from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SamplerSettings from "@/components/pipeline/sampler-settings";
import { Play, ChevronUp, ChevronDown, Trash2, Undo2 } from "lucide-react";

export interface SavedSetRunSetup {
  set: BatchPresetSet;
  overrides: BatchRunOverrides;
  /** set.presets と同じ順の元グループ(変数の前回値固定に使う) */
  groups: SeedRecipeGroup[];
  keepPreviousVariables: boolean;
}

interface SavedSetRunSetupViewProps {
  folder: string;
  groups: SeedRecipeGroup[];
  variableLoras: LoraEntry[];
  physicalPresets: Preset[];
  initialSettings: GenerationSettings;
  onConfirm: (setup: SavedSetRunSetup) => void;
  onCancel: () => void;
}

const SEGMENT_LABEL: Record<string, string> = {
  fixedTags: "固定タグ",
  fixedLora: "固定LoRA",
  preset: "プリセット",
  presetLora: "プリセットLoRA",
  additional: "追加プロンプト",
  variation: "バリエーション",
};

interface UniqueSegment {
  text: string;
  label: string;
  usedBy: number;
}

const chip = (active: boolean) =>
  `rounded border px-2 py-0.5 text-[10px] transition-colors ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border text-muted-foreground hover:border-muted-foreground"
  }`;

const loraLabel = (l: LoraEntry) => l.name.split("/").pop()?.replace(".safetensors", "") ?? l.name;

/**
 * 保存済みフォルダに複数のプリセット(+実行)が含まれるときの実行前設定。
 * 背景などの構成は各レシピのまま保ち、ここで明示的に変えた項目(キャラLoRA・枚数・断片の書き換え)だけを
 * 全プリセットへ一括で適用する。
 */
export default function SavedSetRunSetupView({
  folder,
  groups,
  variableLoras,
  physicalPresets,
  initialSettings,
  onConfirm,
  onCancel,
}: SavedSetRunSetupViewProps) {
  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.name.localeCompare(b.name, "ja", { numeric: true })),
    [groups],
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => sortedGroups.map((g) => g.key));
  const selected = useMemo(
    () => sortedGroups.filter((g) => selectedKeys.includes(g.key)),
    [sortedGroups, selectedKeys],
  );

  // 元レシピのキャラLoRA(重複除去)。差し替え候補にも含める
  const originalLoras = useMemo(() => {
    const map = new Map<string, LoraEntry>();
    for (const g of groups) if (g.recipe.variableLora) map.set(g.recipe.variableLora.name, g.recipe.variableLora);
    return Array.from(map.values());
  }, [groups]);
  const loraChoices = useMemo(() => {
    const names = new Set(variableLoras.map((l) => l.name));
    return [...variableLoras, ...originalLoras.filter((l) => !names.has(l.name))];
  }, [variableLoras, originalLoras]);
  // null=元のまま / number=loraChoices の index / "none"=可変LoRAなし
  const [loraChoice, setLoraChoice] = useState<number | "none" | null>(null);

  // 身体的特徴: null=各レシピのまま / 配列=選んだものを全プリセットへ共通適用
  const physicalChoices = useMemo(
    () =>
      mergePresetsWithSnapshot(
        physicalPresets,
        groups.flatMap((g) => g.recipe.presets?.selectedPhysicals ?? []),
      ),
    [physicalPresets, groups],
  );
  const [physicalIds, setPhysicalIds] = useState<string[] | null>(null);
  const togglePhysical = (id: string) =>
    setPhysicalIds((prev) => {
      const cur = prev ?? [];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });

  const [countText, setCountText] = useState("");
  const [keepVars, setKeepVars] = useState(true);
  const [edits, setEdits] = useState<Record<string, string | null>>({});
  const [segmentsOpen, setSegmentsOpen] = useState(false);
  const [runSettings, setRunSettings] = useState<GenerationSettings>(
    () => groups.find((g) => g.settings)?.settings ?? initialSettings,
  );
  const [samplerOpen, setSamplerOpen] = useState(false);

  // 選択中のレシピ全体で共通に出現する断片(キャラ側のトリガーワードは LoRA 差し替えで扱うため除く)
  const uniqueSegments = useMemo(() => {
    const map = new Map<string, UniqueSegment>();
    for (const g of selected) {
      const seen = new Set<string>();
      for (const s of g.recipe.segments) {
        if (s.source === "variableLora") continue;
        const cur = map.get(s.text);
        if (cur) {
          if (!seen.has(s.text)) cur.usedBy += 1;
        } else {
          const base = SEGMENT_LABEL[s.source] ?? s.source;
          map.set(s.text, {
            text: s.text,
            label: s.presetName ? `${base}: ${s.presetName}` : base,
            usedBy: 1,
          });
        }
        seen.add(s.text);
      }
    }
    return Array.from(map.values());
  }, [selected]);

  const segmentEdits: PromptReplacement[] = Object.entries(edits).flatMap(([from, to]) =>
    (to ?? "") === from ? [] : [{ from, to: to ?? "" }],
  );

  const toggleKey = (key: string) =>
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleConfirm = () => {
    if (selected.length === 0) return;
    const { set, perPreset, groups: ordered } = buildRecipeSet(folder, selected);
    const count = Math.floor(Number(countText));
    for (const id of Object.keys(perPreset)) {
      if (loraChoice === "none") perPreset[id].variableLora = null;
      else if (loraChoice !== null) perPreset[id].variableLora = loraChoices[loraChoice];
      if (physicalIds !== null)
        perPreset[id].physicalPresets = physicalChoices.filter((p) => physicalIds.includes(p.id));
      if (countText.trim() && count >= 1) perPreset[id].batchCount = count;
    }
    onConfirm({
      set,
      groups: ordered,
      keepPreviousVariables: keepVars,
      overrides: {
        variableLora: null,
        physicalPresets: [],
        scenePreset: null,
        // 現在の左カラムの固定タグは混ぜない(各レシピの固定タグを perPreset で使う)
        fixedTags: "",
        settings: runSettings,
        segmentEdits,
        perPreset,
        batchSet: { id: set.id, name: set.name },
        i2iEnabledPresetIds: [],
      },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-4">
          <p className="rounded-lg border bg-muted/30 p-2 text-[10px] text-muted-foreground">
            保存済みフォルダ「{folder}」に含まれる{groups.length}個のプリセットを、保存時のプロンプト構成
            (背景・ポーズ等はプリセットごと)のまま新しいseedで生成します。下で変更した項目だけが全プリセットに適用されます。
          </p>

          {/* プリセット一覧 */}
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <p className="text-xs font-semibold">
                対象プリセット
                <span className="ml-1 font-normal text-muted-foreground">
                  {selected.length}/{groups.length}
                </span>
              </p>
              <button
                onClick={() => setSelectedKeys(sortedGroups.map((g) => g.key))}
                className="text-[10px] text-muted-foreground underline hover:text-foreground"
              >
                全選択
              </button>
              <button
                onClick={() => setSelectedKeys([])}
                className="text-[10px] text-muted-foreground underline hover:text-foreground"
              >
                全解除
              </button>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1.5">
              {sortedGroups.map((g) => {
                const p = g.recipe.presets;
                const detail = [p.selectedScene?.name, p.selectedPose?.name].filter(Boolean).join(" / ");
                return (
                  <label
                    key={g.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selectedKeys.includes(g.key)}
                      onCheckedChange={() => toggleKey(g.key)}
                    />
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                    {detail && (
                      <span className="max-w-40 truncate text-[10px] text-muted-foreground">{detail}</span>
                    )}
                    <span className="shrink-0 text-[10px] text-muted-foreground">{g.seeds.length}枚</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* キャラLoRA */}
          <div>
            <p className="mb-1.5 text-xs font-semibold">キャラLoRA(可変LoRA)</p>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setLoraChoice(null)} className={chip(loraChoice === null)}>
                元のまま
                {originalLoras.length > 0 && `(${originalLoras.map(loraLabel).join(", ")})`}
              </button>
              <button onClick={() => setLoraChoice("none")} className={chip(loraChoice === "none")}>
                なし
              </button>
              {loraChoices.map((l, i) => (
                <button key={l.name} onClick={() => setLoraChoice(i)} className={chip(loraChoice === i)}>
                  {loraLabel(l)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              差し替えるとトリガーワードも新しいLoRAのものに置き換わります。キャラ固有の特徴を別プロンプトで書いている場合は下の断片編集で直してください。
            </p>
          </div>

          {/* 身体的特徴 */}
          <div>
            <p className="mb-1.5 text-xs font-semibold">身体的特徴</p>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setPhysicalIds(null)} className={chip(physicalIds === null)}>
                元のまま
              </button>
              {physicalChoices.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePhysical(p.id)}
                  className={chip(physicalIds?.includes(p.id) ?? false)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              選ぶと全プリセットで共通に差し替わります(複数選択可。選択を全て外すと身体的特徴なし)。
            </p>
          </div>

          {/* 枚数 */}
          <label className="flex items-center gap-2 text-xs">
            <span className="font-semibold">プリセットごとの枚数</span>
            <Input
              type="number"
              min={1}
              value={countText}
              placeholder="元の枚数"
              onChange={(e) => setCountText(e.target.value)}
              className="h-7 w-24 text-xs"
            />
            <span className="text-[10px] text-muted-foreground">空欄=保存時の枚数</span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <Checkbox className="mt-0.5" checked={keepVars} onCheckedChange={(v) => setKeepVars(v === true)} />
            <span>
              <span className="font-semibold">%%変数%% の前回値を各プリセットで引き継ぐ</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                オフにすると、ランダム変数は毎回引き直します。
              </span>
            </span>
          </label>

          {/* 断片編集 */}
          {uniqueSegments.length > 0 && (
            <div>
              <button
                onClick={() => setSegmentsOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 text-xs font-semibold"
              >
                {segmentsOpen ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                プロンプト断片の書き換え(全プリセット共通)
                {segmentEdits.length > 0 && (
                  <span className="text-[10px] font-normal text-muted-foreground">· {segmentEdits.length}件変更</span>
                )}
              </button>
              {segmentsOpen && (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] text-muted-foreground">
                    同じ文言は1つにまとめています。書き換え/削除すると、その文言を含む全プリセットに適用されます。
                  </p>
                  {uniqueSegments.map((s) => {
                    const changed = s.text in edits;
                    const deleted = edits[s.text] === null;
                    const value = changed ? (edits[s.text] ?? "") : s.text;
                    return (
                      <div key={s.text} className="rounded-lg border bg-card p-2">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="truncate text-[10px] font-semibold text-muted-foreground">
                            {s.label}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">· {s.usedBy}プリセット</span>
                          {changed && <span className="text-[10px] text-primary">変更あり</span>}
                          <div className="ml-auto flex shrink-0 gap-0.5">
                            {changed && (
                              <button
                                onClick={() =>
                                  setEdits((prev) => {
                                    const next = { ...prev };
                                    delete next[s.text];
                                    return next;
                                  })
                                }
                                className="rounded p-1 text-muted-foreground hover:bg-muted"
                                title="元に戻す"
                              >
                                <Undo2 className="h-3 w-3" />
                              </button>
                            )}
                            {!deleted && (
                              <button
                                onClick={() => setEdits((prev) => ({ ...prev, [s.text]: null }))}
                                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                title="この断片を削除"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        {deleted ? (
                          <p className="font-mono text-[11px] text-muted-foreground line-through">{s.text}</p>
                        ) : (
                          <Textarea
                            value={value}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [s.text]: e.target.value }))}
                            rows={Math.min(6, value.split("\n").length + 1)}
                            className="font-mono text-[11px]"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* サンプラー設定 */}
          <div>
            <button
              onClick={() => setSamplerOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 text-xs font-semibold"
            >
              {samplerOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              サンプラー設定
            </button>
            {samplerOpen && (
              <div className="mt-2 rounded-lg border bg-card p-3">
                <SamplerSettings settings={runSettings} onChange={setRunSettings} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-t px-4 py-3">
        <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={onCancel}>
          キャンセル
        </Button>
        <Button
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          disabled={selected.length === 0}
          onClick={handleConfirm}
        >
          <Play className="h-3.5 w-3.5" />
          {selected.length}プリセットで実行
        </Button>
      </div>
    </div>
  );
}
