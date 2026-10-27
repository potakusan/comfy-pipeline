"use client";
import { useMemo, useState } from "react";
import {
  type BatchRunOverrides,
  type BatchPreset,
  type LoraEntry,
  type Preset,
  type GenerationSettings,
  type ReleasedSeed,
  type GenerationRecipe,
  type RecipeSegment,
  type PromptReplacement,
  mergePresetsWithSnapshot,
} from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import SamplerSettings from "@/components/pipeline/sampler-settings";
import PresetI2iToggles from "@/components/pipeline/queue/preset-i2i-toggles";
import { Textarea } from "@/components/ui/textarea";
import { Play, ChevronUp, ChevronDown, Sprout, Trash2, Undo2 } from "lucide-react";

interface RunSetupViewProps {
  variableLoras: LoraEntry[];
  physicalPresets: Preset[];
  scenePresets: Preset[];
  /** 実行対象セットのプリセット(下絵の使用可否をプリセット単位で選ばせる) */
  presets: BatchPreset[];
  initialSettings: GenerationSettings;
  /** ギャラリーの販売用選択画像から引き継ぐseedプール(選択されている場合のみ) */
  seedSource?: { folder: string; seeds: ReleasedSeed[] } | null;
  /** 保存済みレシピからの再現時のみ。初期選択・差し替えUI・スロット別オーバーライドを有効にする */
  recipe?: GenerationRecipe;
  countPresets?: Preset[];
  posePresets?: Preset[];
  otherPresets?: Preset[];
  onConfirm: (overrides: BatchRunOverrides) => void;
  onCancel: () => void;
}

/** レシピ再現時に、人数/ポーズ/その他スロットのプリセットを差し替えるチップ選択 */
function SlotPicker({
  title,
  presets,
  selectedIds,
  onToggle,
}: {
  title: string;
  presets: Preset[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold">{title}</p>
      {presets.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">プリセットなし</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                selectedIds.includes(p.id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SEGMENT_SOURCE_LABEL: Record<RecipeSegment["source"], string> = {
  fixedTags: "固定タグ",
  fixedLora: "固定LoRA",
  variableLora: "可変LoRA",
  preset: "プリセット",
  presetLora: "プリセットLoRA",
  additional: "追加プロンプト",
  variation: "バリエーション",
};

/** 断片1つの表示名。プリセット由来はスロット名とプリセット名を添える */
function segmentLabel(s: RecipeSegment): string {
  const base = SEGMENT_SOURCE_LABEL[s.source];
  return s.presetName ? `${base}: ${s.presetName}` : base;
}

/** 断片の編集状態 → 変数解決前プロンプトへ適用する置換ルール。変更の無い断片は含めない。 */
function toSegmentEdits(
  segments: RecipeSegment[],
  edited: Record<number, string | null>,
): PromptReplacement[] {
  return segments.flatMap((s, i) => {
    if (!(i in edited)) return [];
    const to = edited[i] ?? "";
    return to === s.text ? [] : [{ from: s.text, to }];
  });
}

export default function RunSetupView({
  variableLoras,
  physicalPresets,
  scenePresets,
  presets,
  initialSettings,
  seedSource,
  recipe,
  countPresets = [],
  posePresets = [],
  otherPresets = [],
  onConfirm,
  onCancel,
}: RunSetupViewProps) {
  // 保存時のスナップショットを優先して選択肢に含める(ライブラリ側で編集/削除済みでも選べる)
  const choices = useMemo(() => {
    const snap = recipe?.presets;
    return {
      loras:
        recipe?.variableLora &&
        !variableLoras.some((l) => l.name === recipe.variableLora!.name)
          ? [...variableLoras, recipe.variableLora]
          : variableLoras,
      physical: mergePresetsWithSnapshot(physicalPresets, snap?.selectedPhysicals ?? []),
      scene: mergePresetsWithSnapshot(scenePresets, snap?.selectedScene ? [snap.selectedScene] : []),
      count: mergePresetsWithSnapshot(countPresets, snap?.selectedCount ? [snap.selectedCount] : []),
      pose: mergePresetsWithSnapshot(posePresets, snap?.selectedPose ? [snap.selectedPose] : []),
      other: mergePresetsWithSnapshot(otherPresets, snap?.selectedOthers ?? []),
    };
  }, [recipe, variableLoras, physicalPresets, scenePresets, countPresets, posePresets, otherPresets]);

  const [selectedLoraIdx, setSelectedLoraIdx] = useState<number | null>(() => {
    const name = recipe?.variableLora?.name;
    if (!name) return null;
    const idx = choices.loras.findIndex((l) => l.name === name);
    return idx >= 0 ? idx : null;
  });
  const [selectedPhysicalIds, setSelectedPhysicalIds] = useState<string[]>(
    () => recipe?.presets.selectedPhysicals.map((p) => p.id) ?? [],
  );
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    () => recipe?.presets.selectedScene?.id ?? null,
  );
  const [selectedCountId, setSelectedCountId] = useState<string | null>(
    () => recipe?.presets.selectedCount?.id ?? null,
  );
  const [selectedPoseId, setSelectedPoseId] = useState<string | null>(
    () => recipe?.presets.selectedPose?.id ?? null,
  );
  const [selectedOtherIds, setSelectedOtherIds] = useState<string[]>(
    () => recipe?.presets.selectedOthers.map((p) => p.id) ?? [],
  );
  // 断片編集: index → 編集後テキスト(null=削除)。未編集の断片はキー無し
  const [editedSegments, setEditedSegments] = useState<Record<number, string | null>>({});
  const [segmentsOpen, setSegmentsOpen] = useState(false);
  // レシピ再現はプロンプトのみを使うt2iが基本。元画像のseed固定は任意(既定オフ)
  const [inheritSeeds, setInheritSeeds] = useState(false);
  const [batchCount, setBatchCount] = useState(
    () => recipe?.batchPreset?.batchCount ?? (seedSource?.seeds.length || 1),
  );
  const [runSettings, setRunSettings] = useState<GenerationSettings>(initialSettings);
  const [samplerOpen, setSamplerOpen] = useState(false);
  const [i2iEnabledIds, setI2iEnabledIds] = useState<string[]>([]);
  // 良品率で生成枚数を切り詰める調整(#58)。既定オフ。オンのときだけ実行時に
  // /api/gallery/preset-stats(全走査)を取得する。
  const [applyReleaseRateAdjustment, setApplyReleaseRateAdjustment] = useState(false);

  const togglePhysical = (id: string) =>
    setSelectedPhysicalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const usesSeedPool =
    !!seedSource && seedSource.seeds.length > 0 && (!recipe || inheritSeeds);

  const handleConfirm = () => {
    onConfirm({
      variableLora: selectedLoraIdx !== null ? choices.loras[selectedLoraIdx] : null,
      physicalPresets: choices.physical.filter((p) => selectedPhysicalIds.includes(p.id)),
      scenePreset: choices.scene.find((p) => p.id === selectedSceneId) ?? null,
      // レシピ再現時はID参照ではなく、選択中のプリセット(スナップショット/差し替え後)を明示する
      ...(recipe
        ? {
            countPreset: choices.count.find((p) => p.id === selectedCountId) ?? null,
            posePreset: choices.pose.find((p) => p.id === selectedPoseId) ?? null,
            otherPresets: choices.other.filter((p) => selectedOtherIds.includes(p.id)),
            fixedTags: recipe.fixedTags,
            segmentEdits: toSegmentEdits(recipe.segments, editedSegments),
          }
        : {}),
      settings: runSettings,
      seedPool: usesSeedPool ? seedSource.seeds : undefined,
      seedSourceFolder: usesSeedPool ? seedSource.folder : undefined,
      ...(recipe ? { batchCount: Math.max(1, Math.floor(batchCount) || 1) } : {}),
      i2iEnabledPresetIds: i2iEnabledIds,
      applyReleaseRateAdjustment,
    });
  };

  const seedPoolEmpty = !!seedSource && seedSource.seeds.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-4">
          {recipe && seedSource && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground">
                保存済みレシピ「{seedSource.folder}」のプロンプト構成を使って、新しいseedで生成します。
              </p>
              <label className="flex items-center gap-2 text-xs">
                <span className="font-semibold">生成枚数</span>
                <Input
                  type="number"
                  min={1}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  className="h-7 w-20 text-xs"
                />
                <span className="text-[10px] text-muted-foreground">(プリセットごと)</span>
              </label>
              {seedSource.seeds.length > 0 && (
                <label className="flex cursor-pointer items-start gap-2 text-xs">
                  <Checkbox
                    className="mt-0.5"
                    checked={inheritSeeds}
                    onCheckedChange={(v) => setInheritSeeds(v === true)}
                  />
                  <span>
                    <span className="font-semibold">元画像のseedも引き継ぐ</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      オンにすると最大{seedSource.seeds.length}枚に切り詰め、元画像と同じseedで生成します(構図の傾向が似ます)。
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}
          {!recipe && seedSource && (
            <div className="flex items-start gap-1.5 rounded-lg border bg-muted/30 p-2 text-[10px] text-muted-foreground">
              <Sprout className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {seedPoolEmpty ? (
                <span>
                  シード引き継ぎ元「{seedSource.folder}」に販売用選択画像がありません。実行すると通常通りランダムなseedで生成されます。
                </span>
              ) : (
                <span>
                  シード引き継ぎ元: {seedSource.folder}({seedSource.seeds.length}枚)
                  。プロンプト/LoRAが元画像と同一であれば同じ画像を再現し、変更すれば構図の傾向だけ引き継ぎます。
                  各プリセットの生成枚数は最大{seedSource.seeds.length}枚に切り詰められます。
                </span>
              )}
            </div>
          )}

          {/* 可変LoRA */}
          <div>
            <p className="mb-1.5 text-xs font-semibold">可変LoRA</p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedLoraIdx(null)}
                className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                  selectedLoraIdx === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                なし
              </button>
              {choices.loras.map((lora, idx) => {
                const label =
                  lora.name.split("/").pop()?.replace(".safetensors", "") ?? lora.name;
                return (
                  <button
                    key={lora.name}
                    onClick={() => setSelectedLoraIdx(idx === selectedLoraIdx ? null : idx)}
                    className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                      selectedLoraIdx === idx
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 身体的特徴 */}
          <div>
            <p className="mb-1.5 text-xs font-semibold">身体的特徴</p>
            {choices.physical.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">プリセットなし</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {choices.physical.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePhysical(p.id)}
                    className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                      selectedPhysicalIds.includes(p.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* シーン */}
          <div>
            <p className="mb-1.5 text-xs font-semibold">シーン</p>
            {choices.scene.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">プリセットなし</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedSceneId(null)}
                  className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                    selectedSceneId === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  なし
                </button>
                {choices.scene.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedSceneId((prev) => (prev === p.id ? null : p.id))
                    }
                    className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                      selectedSceneId === p.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {recipe && (
            <>
              <SlotPicker
                title="人数"
                presets={choices.count}
                selectedIds={selectedCountId ? [selectedCountId] : []}
                onToggle={(id) => setSelectedCountId((prev) => (prev === id ? null : id))}
              />
              <SlotPicker
                title="ポーズ"
                presets={choices.pose}
                selectedIds={selectedPoseId ? [selectedPoseId] : []}
                onToggle={(id) => setSelectedPoseId((prev) => (prev === id ? null : id))}
              />
              <SlotPicker
                title="その他"
                presets={choices.other}
                selectedIds={selectedOtherIds}
                onToggle={(id) =>
                  setSelectedOtherIds((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                  )
                }
              />
            </>
          )}

          {recipe && recipe.segments.length > 0 && (
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
                プロンプト断片の編集
                {Object.keys(editedSegments).length > 0 && (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    · {Object.keys(editedSegments).length}件変更
                  </span>
                )}
              </button>
              {segmentsOpen && (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] text-muted-foreground">
                    保存時のプロンプトを出どころ別に分けたものです。テキストを書き換える/削除すると、その文言が生成プロンプトの該当箇所で置換されます。
                    ランダム抽選のプリセット行は実行ごとに引き直されるため、保存時と別の行が当たると置換が効きません。
                    プリセット自体の差し替えは上のスロット選択で行ってください。
                  </p>
                  {recipe.segments.map((s, i) => {
                    const deleted = editedSegments[i] === null;
                    const value = i in editedSegments ? (editedSegments[i] ?? "") : s.text;
                    const changed = i in editedSegments;
                    return (
                      <div key={i} className="rounded-lg border bg-card p-2">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="truncate text-[10px] font-semibold text-muted-foreground">
                            {segmentLabel(s)}
                          </span>
                          {changed && (
                            <span className="text-[10px] text-primary">変更あり</span>
                          )}
                          <div className="ml-auto flex shrink-0 gap-0.5">
                            {changed && (
                              <button
                                onClick={() =>
                                  setEditedSegments((prev) => {
                                    const next = { ...prev };
                                    delete next[i];
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
                                onClick={() =>
                                  setEditedSegments((prev) => ({ ...prev, [i]: null }))
                                }
                                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                title="この断片を削除"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        {deleted ? (
                          <p className="font-mono text-[11px] text-muted-foreground line-through">
                            {s.text}
                          </p>
                        ) : (
                          <Textarea
                            value={value}
                            onChange={(e) =>
                              setEditedSegments((prev) => ({ ...prev, [i]: e.target.value }))
                            }
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

          <PresetI2iToggles
            presets={presets}
            enabledIds={i2iEnabledIds}
            onChange={setI2iEnabledIds}
          />

          {/* 良品率調整 */}
          <div>
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <Checkbox
                className="mt-0.5"
                checked={applyReleaseRateAdjustment}
                onCheckedChange={(v) => setApplyReleaseRateAdjustment(v === true)}
              />
              <span>
                <span className="font-semibold">良品率で生成枚数を自動調整する</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  過去の販売用選択率から「当たり1枚に必要な試行回数」を見積もり、指定枚数を上限に切り詰めます。
                  オンにすると実行時に過去実績の集計(やや時間がかかる)を行います。
                </span>
              </span>
            </label>
          </div>

          {/* サンプラー設定 (折りたたみ) */}
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

      <div className="shrink-0 flex gap-2 border-t px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-xs"
          onClick={onCancel}
        >
          キャンセル
        </Button>
        <Button
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={handleConfirm}
        >
          <Play className="h-3.5 w-3.5" />
          実行
        </Button>
      </div>
    </div>
  );
}
