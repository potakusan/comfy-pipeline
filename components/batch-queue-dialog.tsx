"use client";
import { useState } from "react";
import { type BatchPreset, type BatchPresetSet } from "@/lib/comfy";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Layers,
  Plus,
  Play,
  Pencil,
  Trash2,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface BatchQueueDialogProps {
  batchPresetSets: BatchPresetSet[];
  onSaveSet: (set: BatchPresetSet) => void;
  onRemoveSet: (id: string) => void;
  onRunPresets: (presets: BatchPreset[]) => void;
  onCaptureCurrentSettings: (name?: string) => BatchPreset;
}

// Sub-dialog for editing a single preset's editable fields
interface PresetEditorProps {
  preset: BatchPreset;
  onSave: (updated: BatchPreset) => void;
  onCancel: () => void;
}
function PresetEditor({ preset, onSave, onCancel }: PresetEditorProps) {
  const [name, setName] = useState(preset.name);
  const [additionalPrompt, setAdditionalPrompt] = useState(
    preset.additionalPrompt,
  );
  const [additionalPromptMode, setAdditionalPromptMode] = useState(
    preset.additionalPromptMode,
  );
  const [batchCount, setBatchCount] = useState(preset.batchCount);

  const selectionSummary = [
    ...(preset.physicalPresets.length > 0
      ? preset.physicalPresets.map((p) => p.name)
      : []),
    preset.countPreset?.name,
    preset.posePreset?.name,
    preset.scenePreset?.name,
    ...(preset.otherPresets.length > 0
      ? preset.otherPresets.map((p) => p.name)
      : []),
  ].filter(Boolean) as string[];

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
      {selectionSummary.length > 0 && (
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">
            選択内容（読み取り専用）
          </Label>
          <div className="flex flex-wrap gap-1">
            {selectionSummary.map((s) => (
              <Badge key={s} variant="secondary" className="text-[10px]">
                {s}
              </Badge>
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

export default function BatchQueueDialog({
  batchPresetSets,
  onSaveSet,
  onRemoveSet,
  onRunPresets,
  onCaptureCurrentSettings,
}: BatchQueueDialogProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "edit">("list");
  const [editingSet, setEditingSet] = useState<BatchPresetSet | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  function handleRun(set: BatchPresetSet) {
    onRunPresets(set.presets);
    setOpen(false);
  }

  const totalImages = (presets: BatchPreset[]) =>
    presets.reduce((s, p) => s + p.batchCount, 0);

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

      <DialogContent className="flex max-h-[85vh] max-w-4xl! flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            {view === "edit" && (
              <button
                onClick={backToList}
                className="rounded p-0.5 hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {view === "list" ? "一括キュープリセット" : "セット編集"}
          </DialogTitle>
        </DialogHeader>

        {view === "list" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <ScrollArea className="flex-1 px-4 py-3">
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">
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
                                onClick={() => handleRun(set)}
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
            </ScrollArea>
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

        {view === "edit" && editingSet && (
          <div className="flex flex-1 flex-col overflow-hidden">
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

            <ScrollArea className="flex-1 px-4 py-3">
              {editingSet.presets.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                  <p className="text-xs">プリセットがありません</p>
                  <p className="text-[11px]">
                    「現在の設定を追加」でプリセットを作成します
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_80px_80px_80px_50px_60px] gap-2 px-2 text-[10px] font-semibold uppercase text-muted-foreground">
                    <span>名前</span>
                    <span>シーン</span>
                    <span>ポーズ</span>
                    <span>人数</span>
                    <span className="text-right">枚数</span>
                    <span />
                  </div>
                  {editingSet.presets.map((preset, idx) => (
                    <div key={preset.id} className="space-y-1.5">
                      <div
                        className={`grid grid-cols-[1fr_80px_80px_80px_50px_60px] items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${editingPresetId === preset.id ? "border-primary bg-primary/5" : ""}`}
                      >
                        <span className="truncate font-medium">
                          {preset.name}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {preset.scenePreset?.name ?? "—"}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {preset.posePreset?.name ?? "—"}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {preset.countPreset?.name ?? "—"}
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
                          onSave={updatePresetInSet}
                          onCancel={() => setEditingPresetId(null)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

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
                      handleRun(editingSet);
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
      </DialogContent>
    </Dialog>
  );
}
