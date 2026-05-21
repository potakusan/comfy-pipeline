"use client";
import { useState, useRef } from "react";
import {
  type Preset,
  type LoraEntry,
  type PresetCategory,
  assemblePositivePrompt,
} from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Check,
  ChevronDown,
  GripVertical,
  Settings2,
} from "lucide-react";
import TagAutocompleteTextarea from "@/components/tag-autocomplete-textarea";
import { Label } from "@/components/ui/label";
import {
  PresetModal,
  CategoryManagerModal,
  type PresetType,
  TYPE_LABELS,
} from "@/components/preset-modal";

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
  fixedTags: string;
  onSetFixedTags: (v: string) => void;
  onResetFixedTags: () => void;
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
  presetCategories: PresetCategory[];
  onAddCategory: (name: string) => void;
  onRenameCategory: (id: string, name: string) => void;
  onRemoveCategory: (id: string) => void;
}

function SectionHeader({ label, badge }: { label: string; badge: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}{" "}
      <Badge variant="outline" className="ml-1 text-[10px]">
        {badge}
      </Badge>
    </p>
  );
}

function CategoryDivider({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="text-[10px] font-medium text-muted-foreground">{name}</span>
      <div className="flex-1 border-t border-dashed border-border/60" />
    </div>
  );
}

function CategoryGroupHeader({
  name,
  items,
  selectedIds,
  selectionType,
  onSelect,
}: {
  name: string;
  items: Preset[];
  selectedIds: string[];
  selectionType: "radio" | "checkbox";
  onSelect: (id: string) => void;
}) {
  if (selectionType !== "checkbox") {
    return <CategoryDivider name={name} />;
  }
  const groupIds = items.map((p) => p.id);
  const selectedInGroup = groupIds.filter((id) => selectedIds.includes(id));
  const anySelected = selectedInGroup.length > 0;
  const allSelected = selectedInGroup.length === groupIds.length;

  const handleToggle = () => {
    if (anySelected) {
      selectedInGroup.forEach((id) => onSelect(id));
    } else {
      groupIds.forEach((id) => onSelect(id));
    }
  };

  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="text-[10px] font-medium text-muted-foreground">{name}</span>
      <div className="flex-1 border-t border-dashed border-border/60" />
      {groupIds.length > 0 && (
        <button
          onClick={handleToggle}
          className={`shrink-0 rounded px-1 py-0.5 text-[9px] transition-colors ${
            anySelected
              ? "text-blue-500 hover:text-blue-700"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={anySelected ? "このカテゴリの選択を解除" : "このカテゴリをすべて選択"}
        >
          {anySelected ? (allSelected ? "全解除" : "解除") : "全選択"}
        </button>
      )}
    </div>
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
  fixedTags,
  onSetFixedTags,
  onResetFixedTags,
  onSetAdditional,
  onSetAdditionalMode,
  onSetNegative,
  onAddPreset,
  onUpdatePreset,
  onRemovePreset,
  onReorderPresets,
  presetCategories,
  onAddCategory,
  onRenameCategory,
  onRemoveCategory,
}: PromptBuilderProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
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
    promptMode: "all" | "random";
    category?: string;
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
    fixedPrefix: fixedTags,
  });

  const renderSection = (
    label: string,
    badge: string,
    type: PresetType,
    presets: Preset[],
    selectedIds: string[],
    selectionType: "radio" | "checkbox",
    onSelect: (id: string) => void,
    sectionId?: string,
  ) => {
    const uncategorized = presets.filter((p) => !p.category);
    const categorized = presetCategories
      .map((cat) => ({ cat, items: presets.filter((p) => p.category === cat.id) }))
      .filter(({ items }) => items.length > 0);
    const hasCategories = categorized.length > 0;

    return (
      <div id={sectionId}>
        <div className="mb-1 flex items-center justify-between">
          <SectionHeader label={label} badge={badge} />
          <button
            onClick={() => setCategoryManagerOpen(true)}
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            title="カテゴリ管理"
          >
            <Settings2 className="h-2.5 w-2.5" />
          </button>
        </div>
        <div className="space-y-1">
          {hasCategories && uncategorized.length > 0 && (
            <CategoryGroupHeader
              name="未分類"
              items={uncategorized}
              selectedIds={selectedIds}
              selectionType={selectionType}
              onSelect={onSelect}
            />
          )}
          {uncategorized.map((preset) => (
            <DraggableItem
              key={preset.id}
              preset={preset}
              index={presets.indexOf(preset)}
              isSelected={selectedIds.includes(preset.id)}
              selectionType={selectionType}
              onSelect={() => onSelect(preset.id)}
              onEdit={() => openEdit(preset)}
              onReorder={(from, to) => onReorderPresets(type, from, to)}
            />
          ))}
          {categorized.map(({ cat, items }) => (
            <div key={cat.id}>
              <CategoryGroupHeader
                name={cat.name}
                items={items}
                selectedIds={selectedIds}
                selectionType={selectionType}
                onSelect={onSelect}
              />
              {items.map((preset) => (
                <DraggableItem
                  key={preset.id}
                  preset={preset}
                  index={presets.indexOf(preset)}
                  isSelected={selectedIds.includes(preset.id)}
                  selectionType={selectionType}
                  onSelect={() => onSelect(preset.id)}
                  onEdit={() => openEdit(preset)}
                  onReorder={(from, to) => onReorderPresets(type, from, to)}
                />
              ))}
            </div>
          ))}
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
  };

  return (
    <div className="space-y-3">
      {/* Fixed prefix */}
      <div id="p-fixed">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            固定タグ
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs text-muted-foreground"
            onClick={onResetFixedTags}
          >
            リセット
          </Button>
        </div>
        <TagAutocompleteTextarea
          value={fixedTags}
          onChange={onSetFixedTags}
          style={{ minHeight: "60px", fontSize: "10px", fontFamily: "monospace" }}
        />
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
        "p-physical",
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
        "p-count",
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
        "p-pose",
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
        "p-scene",
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
        "p-other",
      )}

      <Separator />

      {/* Additional prompt */}
      <div id="p-add">
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
      <div id="p-neg">
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
          categories={presetCategories}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={
            modalState.preset
              ? () => onRemovePreset(modalState.preset!.id)
              : undefined
          }
        />
      )}

      <CategoryManagerModal
        open={categoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
        categories={presetCategories}
        onAdd={onAddCategory}
        onRename={onRenameCategory}
        onRemove={onRemoveCategory}
      />
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
        e.dataTransfer.setData("text/plain", String(index));
        dragIndex.current = index;
      }}
      onDragOver={(e) => {
        const from = Number(e.dataTransfer.getData("text/plain"));
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
      {preset.promptMode === "random" && (
        <Badge
          variant="outline"
          className="shrink-0 text-[9px] cursor-pointer text-muted-foreground"
          onClick={onSelect}
        >
          ランダム
        </Badge>
      )}
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
