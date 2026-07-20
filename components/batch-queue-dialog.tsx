"use client";
import { useState } from "react";
import {
  type BatchPreset,
  type BatchPresetSet,
  type BatchRunOverrides,
  type LoraEntry,
  type Preset,
  type GenerationSettings,
} from "@/lib/comfy";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import SamplerSettings from "@/components/sampler-settings";
import {
  Layers,
  Plus,
  Play,
  Pencil,
  Trash2,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  ChevronDown as ChevronDownIcon,
} from "lucide-react";

interface BatchQueueDialogProps {
  batchPresetSets: BatchPresetSet[];
  onSaveSet: (set: BatchPresetSet) => void;
  onRemoveSet: (id: string) => void;
  onRunPresets: (presets: BatchPreset[], overrides: BatchRunOverrides) => void;
  onCaptureCurrentSettings: (name?: string) => BatchPreset;
  /** 可変LoRA一覧 (実行前設定で選択させる) */
  variableLoras: LoraEntry[];
  /** 身体的特徴プリセット一覧 (実行前設定で選択させる) */
  physicalPresets: Preset[];
  /** シーンプリセット一覧 (実行前設定で選択させる) */
  scenePresets: Preset[];
  /** 人数プリセット一覧 (保存内容編集用) */
  countPresets: Preset[];
  /** ポーズプリセット一覧 (保存内容編集用) */
  posePresets: Preset[];
  /** その他プリセット一覧 (保存内容編集用) */
  otherPresets: Preset[];
  /** サンプラー設定の初期値 */
  currentSettings: GenerationSettings;
}

// ---------------------------------------------------------------------------
// Preset editor (inline within set-edit view)
// ---------------------------------------------------------------------------

interface PresetEditorProps {
  preset: BatchPreset;
  countPresets: Preset[];
  posePresets: Preset[];
  otherPresets: Preset[];
  onSave: (updated: BatchPreset) => void;
  onCancel: () => void;
}

function PresetEditor({ preset, countPresets, posePresets, otherPresets, onSave, onCancel }: PresetEditorProps) {
  const [name, setName] = useState(preset.name);
  const [additionalPrompt, setAdditionalPrompt] = useState(
    preset.additionalPrompt,
  );
  const [additionalPromptMode, setAdditionalPromptMode] = useState(
    preset.additionalPromptMode,
  );
  const [batchCount, setBatchCount] = useState(preset.batchCount);
  const [selectedCountId, setSelectedCountId] = useState<string | null>(preset.countPresetId);
  const [selectedPoseId, setSelectedPoseId] = useState<string | null>(preset.posePresetId);
  const [selectedOtherIds, setSelectedOtherIds] = useState<string[]>([...preset.otherPresetIds]);

  const toggleOther = (id: string) =>
    setSelectedOtherIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const chipClass = (active: boolean) =>
    `rounded border px-2 py-0.5 text-[10px] transition-colors cursor-pointer ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border text-muted-foreground hover:border-muted-foreground"
    }`;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">プリセット編集</p>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onCancel}
          >
            キャンセル
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                ...preset,
                name: name.trim(),
                additionalPrompt,
                additionalPromptMode,
                batchCount,
                countPresetId: selectedCountId,
                posePresetId: selectedPoseId,
                otherPresetIds: selectedOtherIds,
              })
            }
          >
            保存
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="mb-1 text-xs">プリセット名</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-xs"
            autoFocus
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">枚数</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={batchCount}
            onChange={(e) =>
              setBatchCount(Math.max(1, parseInt(e.target.value) || 1))
            }
            className="h-7 text-xs"
          />
        </div>
      </div>
      {countPresets.length > 0 && (
        <div>
          <Label className="mb-1 text-xs">人数</Label>
          <div className="flex flex-wrap gap-1">
            <button className={chipClass(selectedCountId === null)} onClick={() => setSelectedCountId(null)}>なし</button>
            {countPresets.map((p) => (
              <button key={p.id} className={chipClass(selectedCountId === p.id)} onClick={() => setSelectedCountId((prev) => prev === p.id ? null : p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {posePresets.length > 0 && (
        <div>
          <Label className="mb-1 text-xs">ポーズ</Label>
          <div className="flex flex-wrap gap-1">
            <button className={chipClass(selectedPoseId === null)} onClick={() => setSelectedPoseId(null)}>なし</button>
            {posePresets.map((p) => (
              <button key={p.id} className={chipClass(selectedPoseId === p.id)} onClick={() => setSelectedPoseId((prev) => prev === p.id ? null : p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {otherPresets.length > 0 && (
        <div>
          <Label className="mb-1 text-xs">その他</Label>
          <div className="flex flex-wrap gap-1">
            {otherPresets.map((p) => (
              <button key={p.id} className={chipClass(selectedOtherIds.includes(p.id))} onClick={() => toggleOther(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs">追加プロンプト</Label>
          <div className="flex gap-1.5">
            {(["all", "random"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setAdditionalPromptMode(mode)}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                  additionalPromptMode === mode
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {mode === "all" ? "全行" : "ランダム1行"}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          value={additionalPrompt}
          onChange={(e) => setAdditionalPrompt(e.target.value)}
          rows={3}
          className="font-mono text-xs"
          placeholder="追加プロンプト（ランダムモードの場合は1行1タグ）"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run setup view: 可変LoRA / 身体的特徴 / シーン / サンプラー設定
// ---------------------------------------------------------------------------

interface RunSetupProps {
  variableLoras: LoraEntry[];
  physicalPresets: Preset[];
  scenePresets: Preset[];
  initialSettings: GenerationSettings;
  onConfirm: (overrides: BatchRunOverrides) => void;
  onCancel: () => void;
}

function RunSetup({
  variableLoras,
  physicalPresets,
  scenePresets,
  initialSettings,
  onConfirm,
  onCancel,
}: RunSetupProps) {
  const [selectedLoraIdx, setSelectedLoraIdx] = useState<number | null>(null);
  const [selectedPhysicalIds, setSelectedPhysicalIds] = useState<string[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [runSettings, setRunSettings] = useState<GenerationSettings>(initialSettings);
  const [samplerOpen, setSamplerOpen] = useState(false);

  const togglePhysical = (id: string) =>
    setSelectedPhysicalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleConfirm = () => {
    onConfirm({
      variableLora: selectedLoraIdx !== null ? variableLoras[selectedLoraIdx] : null,
      physicalPresets: physicalPresets.filter((p) => selectedPhysicalIds.includes(p.id)),
      scenePreset: scenePresets.find((p) => p.id === selectedSceneId) ?? null,
      settings: runSettings,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-4">
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
              {variableLoras.map((lora, idx) => {
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
            {physicalPresets.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">プリセットなし</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {physicalPresets.map((p) => (
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
            {scenePresets.length === 0 ? (
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
                {scenePresets.map((p) => (
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

          {/* サンプラー設定 (折りたたみ) */}
          <div>
            <button
              onClick={() => setSamplerOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 text-xs font-semibold"
            >
              {samplerOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
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

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export default function BatchQueueDialog({
  batchPresetSets,
  onSaveSet,
  onRemoveSet,
  onRunPresets,
  onCaptureCurrentSettings,
  variableLoras,
  physicalPresets,
  scenePresets,
  countPresets,
  posePresets,
  otherPresets,
  currentSettings,
}: BatchQueueDialogProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "edit" | "run-setup">("list");
  const [editingSet, setEditingSet] = useState<BatchPresetSet | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingRunSet, setPendingRunSet] = useState<BatchPresetSet | null>(null);

  function openNewSet() {
    const newSet: BatchPresetSet = {
      id: crypto.randomUUID(),
      name: "新しいセット",
      presets: [],
    };
    setEditingSet(newSet);
    setView("edit");
  }

  function openEditSet(set: BatchPresetSet) {
    setEditingSet({ ...set, presets: [...set.presets] });
    setEditingPresetId(null);
    setView("edit");
  }

  function backToList() {
    setView("list");
    setEditingSet(null);
    setEditingPresetId(null);
    setPendingRunSet(null);
  }

  function saveSet() {
    if (!editingSet) return;
    onSaveSet(editingSet);
    backToList();
  }

  function addCurrentAsPreset() {
    if (!editingSet) return;
    const preset = onCaptureCurrentSettings();
    setEditingSet({ ...editingSet, presets: [...editingSet.presets, preset] });
    setEditingPresetId(preset.id);
  }

  function updatePresetInSet(updated: BatchPreset) {
    if (!editingSet) return;
    setEditingSet({
      ...editingSet,
      presets: editingSet.presets.map((p) =>
        p.id === updated.id ? updated : p,
      ),
    });
    setEditingPresetId(null);
  }

  function deletePresetFromSet(id: string) {
    if (!editingSet) return;
    setEditingSet({
      ...editingSet,
      presets: editingSet.presets.filter((p) => p.id !== id),
    });
    if (editingPresetId === id) setEditingPresetId(null);
  }

  function movePreset(idx: number, dir: -1 | 1) {
    if (!editingSet) return;
    const presets = [...editingSet.presets];
    const target = idx + dir;
    if (target < 0 || target >= presets.length) return;
    [presets[idx], presets[target]] = [presets[target], presets[idx]];
    setEditingSet({ ...editingSet, presets });
  }

  function openRunSetup(set: BatchPresetSet) {
    setPendingRunSet(set);
    setView("run-setup");
  }

  function handleRunConfirm(overrides: BatchRunOverrides) {
    if (!pendingRunSet) return;
    onRunPresets(pendingRunSet.presets, overrides);
    setOpen(false);
    backToList();
  }

  const totalImages = (presets: BatchPreset[]) =>
    presets.reduce((s, p) => s + p.batchCount, 0);

  const dialogTitle =
    view === "list"
      ? "一括キュープリセット"
      : view === "run-setup"
        ? "実行前設定"
        : "セット編集";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) backToList();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Layers className="h-3.5 w-3.5" />
          一括キュー
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[85vh] max-w-4xl! flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            {(view === "edit" || view === "run-setup") && (
              <button
                onClick={backToList}
                className="rounded p-0.5 hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {batchPresetSets.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                  <Layers className="h-10 w-10 opacity-20" />
                  <p className="text-xs">プリセットセットがありません</p>
                  <p className="text-[11px]">
                    「新しいセットを作成」から始めましょう
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {batchPresetSets.map((set) => (
                    <div key={set.id} className="rounded-lg border bg-card p-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-2">
                            <p className="min-w-0 truncate text-sm font-medium">
                              {set.name}
                            </p>
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-[10px]"
                            >
                              {set.presets.length}プリセット
                            </Badge>
                            {set.presets.length > 0 && (
                              <Badge
                                variant="outline"
                                className="shrink-0 text-[10px]"
                              >
                                計{totalImages(set.presets)}枚
                              </Badge>
                            )}
                          </div>
                          {set.presets.length > 0 && (
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {set.presets.map((p) => p.name).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => openEditSet(set)}
                          >
                            <Pencil className="h-3 w-3" />
                            編集
                          </Button>
                          {confirmDeleteId === set.id ? (
                            <>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  onRemoveSet(set.id);
                                  setConfirmDeleteId(null);
                                }}
                              >
                                削除確認
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                戻る
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setConfirmDeleteId(set.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 gap-1 text-xs"
                                disabled={set.presets.length === 0}
                                onClick={() => openRunSetup(set)}
                              >
                                <Play className="h-3 w-3" />
                                実行
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 border-t px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={openNewSet}
              >
                <Plus className="h-3.5 w-3.5" />
                新しいセットを作成
              </Button>
            </div>
          </div>
        )}

        {/* ── EDIT VIEW ── */}
        {view === "edit" && editingSet && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b px-4 py-2">
              <Input
                value={editingSet.name}
                onChange={(e) =>
                  setEditingSet({ ...editingSet, name: e.target.value })
                }
                className="h-8 text-sm font-medium"
                placeholder="セット名"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {editingSet.presets.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                  <p className="text-xs">プリセットがありません</p>
                  <p className="text-[11px]">
                    「現在の設定を追加」でプリセットを作成します
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_80px_80px_50px_60px] gap-2 px-2 text-[10px] font-semibold uppercase text-muted-foreground">
                    <span>名前</span>
                    <span>ポーズ</span>
                    <span>人数</span>
                    <span className="text-right">枚数</span>
                    <span />
                  </div>
                  {editingSet.presets.map((preset, idx) => (
                    <div key={preset.id} className="space-y-1.5">
                      <div
                        className={`grid grid-cols-[1fr_80px_80px_50px_60px] items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${editingPresetId === preset.id ? "border-primary bg-primary/5" : ""}`}
                      >
                        <span className="truncate font-medium">
                          {preset.name}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {posePresets.find((p) => p.id === preset.posePresetId)?.name ?? "—"}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {countPresets.find((p) => p.id === preset.countPresetId)?.name ?? "—"}
                        </span>
                        <span className="text-right text-muted-foreground">
                          {preset.batchCount}
                        </span>
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => movePreset(idx, -1)}
                            disabled={idx === 0}
                            className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => movePreset(idx, 1)}
                            disabled={idx === editingSet.presets.length - 1}
                            className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() =>
                              setEditingPresetId(
                                editingPresetId === preset.id
                                  ? null
                                  : preset.id,
                              )
                            }
                            className="rounded p-0.5 hover:bg-muted"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deletePresetFromSet(preset.id)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {editingPresetId === preset.id && (
                        <PresetEditor
                          preset={preset}
                          countPresets={countPresets}
                          posePresets={posePresets}
                          otherPresets={otherPresets}
                          onSave={updatePresetInSet}
                          onCancel={() => setEditingPresetId(null)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 space-y-2 border-t px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={addCurrentAsPreset}
              >
                <Plus className="h-3.5 w-3.5" />
                現在の設定をプリセットとして追加
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={backToList}
                >
                  キャンセル
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={!editingSet.name.trim()}
                  onClick={saveSet}
                >
                  保存
                </Button>
                {editingSet.presets.length > 0 && (
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => {
                      saveSet();
                      openRunSetup(editingSet);
                    }}
                  >
                    <Play className="h-3.5 w-3.5" />
                    保存して実行
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── RUN SETUP VIEW ── */}
        {view === "run-setup" && pendingRunSet && (
          <RunSetup
            variableLoras={variableLoras}
            physicalPresets={physicalPresets}
            scenePresets={scenePresets}
            initialSettings={currentSettings}
            onConfirm={handleRunConfirm}
            onCancel={backToList}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
