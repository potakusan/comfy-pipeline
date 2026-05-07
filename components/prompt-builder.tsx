"use client";
import { useState, useRef } from "react";
import {
  type Preset,
  type LoraEntry,
  assemblePositivePrompt,
} from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import TagAutocompleteTextarea from "@/components/tag-autocomplete-textarea";
import {
  LoraPickerDialog,
  type LmLoraItem,
} from "@/components/lora-picker-dialog";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  ChevronDown,
  Library,
  X,
  GripVertical,
} from "lucide-react";
import { FIXED_POSITIVE_PREFIX } from "@/lib/config";

type PresetType = "physical" | "count" | "pose" | "scene" | "other";

const TYPE_LABELS: Record<PresetType, string> = {
  physical: "身体的特徴",
  count: "人数",
  pose: "ポーズ",
  scene: "シーン",
  other: "その他",
};

interface PromptBuilderProps {
  variableLora: LoraEntry | null;
  physicalPresets: Preset[];
  scenePresets: Preset[];
  countPresets: Preset[];
  posePresets: Preset[];
  otherPresets: Preset[];
  selectedPhysicalIds: string[];
  selectedSceneId: string | null;
  selectedCountId: string | null;
  selectedPoseId: string | null;
  selectedOtherIds: string[];
  additionalPrompt: string;
  additionalPromptMode: "all" | "random";
  negativePrompt: string;
  onTogglePhysical: (id: string) => void;
  onSelectScene: (id: string | null) => void;
  onSelectCount: (id: string | null) => void;
  onSelectPose: (id: string | null) => void;
  onToggleOther: (id: string) => void;
  onSetAdditional: (v: string) => void;
  onSetAdditionalMode: (mode: "all" | "random") => void;
  onSetNegative: (v: string) => void;
  onAddPreset: (preset: Omit<Preset, "id">) => void;
  onUpdatePreset: (id: string, updates: Partial<Preset>) => void;
  onRemovePreset: (id: string) => void;
  onReorderPresets: (
    type: PresetType,
    fromIndex: number,
    toIndex: number,
  ) => void;
}

// --- Inline LoRA form ---
const EMPTY_LORA: LoraEntry = {
  name: "",
  strength: 1.0,
  clipStrength: 1.0,
  triggerWords: "",
};

function LoraSection({
  lora,
  onChange,
}: {
  lora: LoraEntry | undefined;
  onChange: (lora: LoraEntry | undefined) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const draft = lora ?? EMPTY_LORA;
  const set = <K extends keyof LoraEntry>(key: K, val: LoraEntry[K]) =>
    onChange({ ...draft, [key]: val });
  const handlePick = (item: LmLoraItem) => {
    const triggerWords = item.civitai?.trainedWords?.join("\n") ?? "";
    onChange({ ...draft, name: item.file_name, triggerWords });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">LoRA（任意）</Label>
        {lora ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 gap-1 text-xs text-muted-foreground"
            onClick={() => onChange(undefined)}
          >
            <X className="h-3 w-3" />
            解除
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-5 gap-1 text-xs"
            onClick={() => onChange({ ...EMPTY_LORA })}
          >
            <Plus className="h-3 w-3" />
            LoRAを紐付け
          </Button>
        )}
      </div>
      {lora && (
        <div className="space-y-2 rounded-md border p-2">
          <div className="flex items-center gap-2">
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="LoRAファイル名"
              className="h-7 flex-1 font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1 text-xs"
              onClick={() => setPickerOpen(true)}
            >
              <Library className="h-3 w-3" />
              選択
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-[10px]">強度</Label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {draft.strength.toFixed(2)}
                </span>
              </div>
              <Slider
                min={0}
                max={2}
                step={0.05}
                value={[draft.strength]}
                onValueChange={([v]) => set("strength", v)}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-[10px]">CLIP強度</Label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {draft.clipStrength.toFixed(2)}
                </span>
              </div>
              <Slider
                min={0}
                max={2}
                step={0.05}
                value={[draft.clipStrength]}
                onValueChange={([v]) => set("clipStrength", v)}
              />
            </div>
          </div>
          <div>
            <Label className="mb-1 text-[10px]">トリガーワード</Label>
            <TagAutocompleteTextarea
              value={draft.triggerWords}
              onChange={(v) => set("triggerWords", v)}
              placeholder="例: character_name, blue hair, ..."
              style={{ minHeight: "50px" }}
            />
          </div>
        </div>
      )}
      <LoraPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePick}
      />
    </>
  );
}

// --- Preset Modal ---
interface PresetModalProps {
  open: boolean;
  preset: Preset | null;
  type: PresetType;
  onClose: () => void;
  onSave: (updates: { name: string; prompt: string; lora?: LoraEntry }) => void;
  onDelete?: () => void;
}

function PresetModal({
  open,
  preset,
  type,
  onClose,
  onSave,
  onDelete,
}: PresetModalProps) {
  const [name, setName] = useState(preset?.name ?? "");
  const [prompt, setPrompt] = useState(preset?.prompt ?? "");
  const [lora, setLora] = useState<LoraEntry | undefined>(preset?.lora);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setConfirmDelete(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {!preset ? `${TYPE_LABELS[type]}プリセット追加` : "プリセット編集"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 text-xs">名前</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="プリセット名"
              className="text-sm"
              autoFocus
            />
          </div>
          <div>
            <Label className="mb-1 text-xs">プロンプト</Label>
            <TagAutocompleteTextarea
              value={prompt}
              onChange={setPrompt}
              placeholder="プロンプトを入力（日本語/英語でタグ補完が使えます）"
              style={{ minHeight: "100px" }}
            />
          </div>
          <LoraSection lora={lora} onChange={setLora} />
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {onDelete && !confirmDelete && (
            <Button
              variant="outline"
              className="mr-auto text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              削除
            </Button>
          )}
          {confirmDelete && (
            <div className="mr-auto flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDelete?.();
                  onClose();
                }}
              >
                本当に削除
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                キャンセル
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onSave({ name: name.trim(), prompt, lora });
              onClose();
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Section helpers ---
function SectionHeader({ label, badge }: { label: string; badge: string }) {
  return (
    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}{" "}
      <Badge variant="outline" className="ml-1 text-[10px]">
        {badge}
      </Badge>
    </p>
  );
}

export default function PromptBuilder({
  variableLora,
  physicalPresets,
  scenePresets,
  countPresets,
  posePresets,
  otherPresets,
  selectedPhysicalIds,
  selectedSceneId,
  selectedCountId,
  selectedPoseId,
  selectedOtherIds,
  additionalPrompt,
  additionalPromptMode,
  negativePrompt,
  onTogglePhysical,
  onSelectScene,
  onSelectCount,
  onSelectPose,
  onToggleOther,
  onSetAdditional,
  onSetAdditionalMode,
  onSetNegative,
  onAddPreset,
  onUpdatePreset,
  onRemovePreset,
  onReorderPresets,
}: PromptBuilderProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [modalState, setModalState] = useState<{
    open: boolean;
    preset: Preset | null;
    type: PresetType;
  }>({ open: false, preset: null, type: "physical" });

  const openAdd = (type: PresetType) =>
    setModalState({ open: true, preset: null, type });
  const openEdit = (preset: Preset) =>
    setModalState({ open: true, preset, type: preset.type as PresetType });
  const closeModal = () => setModalState((s) => ({ ...s, open: false }));

  const handleSave = (updates: {
    name: string;
    prompt: string;
    lora?: LoraEntry;
  }) => {
    if (modalState.preset) {
      onUpdatePreset(modalState.preset.id, updates);
    } else {
      onAddPreset({ ...updates, type: modalState.type });
    }
  };

  const selectedPhysicals = physicalPresets.filter((p) =>
    selectedPhysicalIds.includes(p.id),
  );
  const selectedScene =
    scenePresets.find((p) => p.id === selectedSceneId) ?? null;
  const selectedCount =
    countPresets.find((p) => p.id === selectedCountId) ?? null;
  const selectedPose = posePresets.find((p) => p.id === selectedPoseId) ?? null;
  const selectedOthers = otherPresets.filter((p) =>
    selectedOtherIds.includes(p.id),
  );

  const assembled = assemblePositivePrompt({
    variableLora,
    selectedPhysicalPresets: selectedPhysicals,
    selectedCountPreset: selectedCount,
    selectedPosePreset: selectedPose,
    selectedScenePreset: selectedScene,
    selectedOtherPresets: selectedOthers,
    additionalPrompt,
  });

  // Helper to render a draggable section
  const renderSection = (
    label: string,
    badge: string,
    type: PresetType,
    presets: Preset[],
    selectedIds: string[],
    selectionType: "radio" | "checkbox",
    onSelect: (id: string) => void,
  ) => (
    <div>
      <SectionHeader label={label} badge={badge} />
      <div className="space-y-1">
        {presets.map((preset, index) => {
          const isSelected = selectedIds.includes(preset.id);
          return (
            <DraggableItem
              key={preset.id}
              preset={preset}
              index={index}
              isSelected={isSelected}
              selectionType={selectionType}
              onSelect={() => onSelect(preset.id)}
              onEdit={() => openEdit(preset)}
              onReorder={(from, to) => onReorderPresets(type, from, to)}
            />
          );
        })}
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-full gap-1 text-xs"
          onClick={() => openAdd(type)}
        >
          <Plus className="h-3 w-3" />
          {TYPE_LABELS[type]}追加
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Fixed prefix */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          固定タグ
        </p>
        <div className="rounded-md bg-muted/50 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground whitespace-pre-line">
          {FIXED_POSITIVE_PREFIX}
        </div>
      </div>

      <Separator />
      {renderSection(
        "身体的特徴",
        "複数可",
        "physical",
        physicalPresets,
        selectedPhysicalIds,
        "checkbox",
        onTogglePhysical,
      )}

      <Separator />
      {renderSection(
        "人数",
        "1択",
        "count",
        countPresets,
        selectedCountId ? [selectedCountId] : [],
        "radio",
        (id) => onSelectCount(selectedCountId === id ? null : id),
      )}

      <Separator />
      {renderSection(
        "ポーズ",
        "1択",
        "pose",
        posePresets,
        selectedPoseId ? [selectedPoseId] : [],
        "radio",
        (id) => onSelectPose(selectedPoseId === id ? null : id),
      )}

      <Separator />
      {renderSection(
        "シーン",
        "1択",
        "scene",
        scenePresets,
        selectedSceneId ? [selectedSceneId] : [],
        "radio",
        (id) => onSelectScene(selectedSceneId === id ? null : id),
      )}

      <Separator />
      {renderSection(
        "その他",
        "複数可",
        "other",
        otherPresets,
        selectedOtherIds,
        "checkbox",
        onToggleOther,
      )}

      <Separator />

      {/* Additional prompt */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label className="text-xs">追加プロンプト（自由記述）</Label>
          <div className="flex items-center gap-2">
            {(["all", "random"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onSetAdditionalMode(mode)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border transition-colors ${
                  additionalPromptMode === mode
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full border ${additionalPromptMode === mode ? "border-primary-foreground bg-primary-foreground" : "border-muted-foreground"}`}
                />
                {mode === "all" ? "全行使用" : "ランダム1行"}
              </button>
            ))}
          </div>
        </div>
        <TagAutocompleteTextarea
          value={additionalPrompt}
          onChange={onSetAdditional}
          placeholder={
            additionalPromptMode === "random"
              ? "1行1タグで入力。生成ごとにランダムで1行が使われます。"
              : "自由にプロンプトを追記... （日本語/英語でタグ補完）"
          }
          style={{ minHeight: "70px" }}
        />
        {additionalPromptMode === "random" && additionalPrompt.trim() && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {additionalPrompt.split("\n").filter((s) => s.trim()).length}行 —
            生成ごとに1行がランダム選択されます
          </p>
        )}
      </div>

      {/* Negative prompt */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs">ネガティブプロンプト</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs text-muted-foreground"
            onClick={() =>
              onSetNegative(
                "worst quality, low quality, bad hands, bad anatomy, watermark, username,\ncensored,\nextra fingers,",
              )
            }
          >
            リセット
          </Button>
        </div>
        <TagAutocompleteTextarea
          value={negativePrompt}
          onChange={onSetNegative}
          style={{ minHeight: "70px" }}
        />
      </div>

      {/* Preview */}
      <div>
        <button
          onClick={() => setShowPreview((v) => !v)}
          className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showPreview ? "" : "-rotate-90"}`}
          />
          組み立てプロンプトプレビュー
        </button>
        {showPreview && (
          <div className="mt-1 rounded-md bg-muted/50 px-2 py-1.5 font-mono text-[10px] leading-relaxed whitespace-pre-line text-foreground">
            {assembled}
          </div>
        )}
      </div>

      {modalState.open && (
        <PresetModal
          open={modalState.open}
          preset={modalState.preset}
          type={modalState.type}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={
            modalState.preset
              ? () => onRemovePreset(modalState.preset!.id)
              : undefined
          }
        />
      )}
    </div>
  );
}

// Extracted to avoid re-render issues with drag state
function DraggableItem({
  preset,
  index,
  isSelected,
  selectionType,
  onSelect,
  onEdit,
  onReorder,
}: {
  preset: Preset;
  index: number;
  isSelected: boolean;
  selectionType: "radio" | "checkbox";
  onSelect: () => void;
  onEdit: () => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const dragIndex = useRef<number | null>(null);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // store index in dataTransfer so cross-list drops are ignored
        e.dataTransfer.setData("text/plain", String(index));
        dragIndex.current = index;
      }}
      onDragOver={(e) => {
        const from = Number(e.dataTransfer.getData("text/plain"));
        // only react to drags within same list (same totalCount check is imprecise but workable)
        if (isNaN(from)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        if (!isNaN(from) && from !== index) {
          onReorder(from, index);
        }
        setIsOver(false);
      }}
      onDragEnd={() => setIsOver(false)}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
          : "border-border hover:border-muted-foreground/50"
      } ${isOver ? "border-blue-400 opacity-60" : ""}`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 active:cursor-grabbing" />
      <button
        onClick={onSelect}
        className={`flex h-4 w-4 shrink-0 items-center justify-center border-2 transition-colors ${
          selectionType === "radio" ? "rounded-full" : "rounded-sm"
        } ${isSelected ? "border-blue-500 bg-blue-500" : "border-muted-foreground"}`}
      >
        {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
      </button>
      <span
        className="flex-1 truncate text-xs font-medium cursor-pointer"
        onClick={onSelect}
      >
        {preset.name}
      </span>
      {preset.lora && (
        <Badge
          variant="secondary"
          className="shrink-0 text-[9px] cursor-pointer"
          onClick={onSelect}
        >
          LoRA
        </Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 opacity-50 hover:opacity-100"
        onClick={onEdit}
      >
        <Pencil className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}
