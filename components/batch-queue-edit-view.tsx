"use client";
import { useState } from "react";
import { type BatchPreset, type BatchPresetSet, type Preset } from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Play } from "lucide-react";

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
// Set editor view
// ---------------------------------------------------------------------------

interface EditViewProps {
  initialSet: BatchPresetSet;
  countPresets: Preset[];
  posePresets: Preset[];
  otherPresets: Preset[];
  onCaptureCurrentSettings: (name?: string) => BatchPreset;
  onSave: (set: BatchPresetSet) => void;
  onSaveAndRun: (set: BatchPresetSet) => void;
  onCancel: () => void;
}

export default function EditView({
  initialSet,
  countPresets,
  posePresets,
  otherPresets,
  onCaptureCurrentSettings,
  onSave,
  onSaveAndRun,
  onCancel,
}: EditViewProps) {
  const [editingSet, setEditingSet] = useState<BatchPresetSet>(() => ({
    ...initialSet,
    presets: [...initialSet.presets],
  }));
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  function addCurrentAsPreset() {
    const preset = onCaptureCurrentSettings();
    setEditingSet({ ...editingSet, presets: [...editingSet.presets, preset] });
    setEditingPresetId(preset.id);
  }

  function updatePresetInSet(updated: BatchPreset) {
    setEditingSet({
      ...editingSet,
      presets: editingSet.presets.map((p) =>
        p.id === updated.id ? updated : p,
      ),
    });
    setEditingPresetId(null);
  }

  function deletePresetFromSet(id: string) {
    setEditingSet({
      ...editingSet,
      presets: editingSet.presets.filter((p) => p.id !== id),
    });
    if (editingPresetId === id) setEditingPresetId(null);
  }

  function movePreset(idx: number, dir: -1 | 1) {
    const presets = [...editingSet.presets];
    const target = idx + dir;
    if (target < 0 || target >= presets.length) return;
    [presets[idx], presets[target]] = [presets[target], presets[idx]];
    setEditingSet({ ...editingSet, presets });
  }

  return (
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
            onClick={onCancel}
          >
            キャンセル
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 text-xs"
            disabled={!editingSet.name.trim()}
            onClick={() => onSave(editingSet)}
          >
            保存
          </Button>
          {editingSet.presets.length > 0 && (
            <Button
              size="sm"
              variant="default"
              className="flex-1 gap-1.5 text-xs"
              onClick={() => onSaveAndRun(editingSet)}
            >
              <Play className="h-3.5 w-3.5" />
              保存して実行
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
