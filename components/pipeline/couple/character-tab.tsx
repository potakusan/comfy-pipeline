"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import CategoryDivider from "@/components/pipeline/category-divider";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { GripVertical, Pencil, Settings2, Plus } from "lucide-react";
import { type CoupleRegion, REGION_COLORS } from "@/lib/couple";
import {
  type Preset,
  type LoraEntry,
  type PresetCategory,
  groupPresetsByCategory,
} from "@/lib/comfy";
import { LoraSection } from "@/components/pipeline/lora/lora-section";
import {
  PresetModal,
  CategoryManagerModal,
  type PresetType,
} from "@/components/pipeline/prompt/preset-modal";

// ---------------------------------------------------------------------------
// Single preset list item (checkbox select, draggable for reorder)
// ---------------------------------------------------------------------------

function PresetListItem({
  preset,
  index,
  checked,
  onToggle,
  onEdit,
  onReorder,
}: {
  preset: Preset;
  index: number;
  checked: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onReorder: (from: number, to: number) => void;
}) {
  const { isOver, ...dragHandlers } = useDragReorder(index, onReorder);

  return (
    <div
      {...dragHandlers}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors ${
        checked
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/50"
      } ${isOver ? "border-blue-400 opacity-60" : ""}`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 active:cursor-grabbing" />
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="h-3.5 w-3.5 shrink-0"
      />
      <span
        className="flex-1 truncate text-xs font-medium cursor-pointer"
        onClick={onToggle}
        title={preset.prompt}
      >
        {preset.name}
      </span>
      {preset.promptMode === "random" && (
        <Badge
          variant="outline"
          className="shrink-0 text-[9px] text-muted-foreground"
        >
          ランダム
        </Badge>
      )}
      {preset.lora && (
        <Badge variant="secondary" className="shrink-0 text-[9px]">
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

// ---------------------------------------------------------------------------
// Preset list section (grouped by category)
// ---------------------------------------------------------------------------

function PresetListSection({
  presets,
  type,
  label,
  presetCategories,
  selectedIds,
  onToggle,
  onOpenAdd,
  onOpenEdit,
  onReorder,
  onOpenCategoryManager,
}: {
  presets: Preset[];
  type: PresetType;
  label: string;
  presetCategories: PresetCategory[];
  selectedIds: Set<string>;
  onToggle: (preset: Preset) => void;
  onOpenAdd: (type: PresetType) => void;
  onOpenEdit: (preset: Preset) => void;
  onReorder: (type: PresetType, from: number, to: number) => void;
  onOpenCategoryManager: () => void;
}) {
  const { uncategorized, categorized, hasCategories } = groupPresetsByCategory(
    presets,
    presetCategories,
  );

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenCategoryManager}
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            title="カテゴリ管理"
            aria-label="カテゴリ管理"
          >
            <Settings2 className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={() => onOpenAdd(type)}
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            title={`${label}プリセットを追加`}
          >
            <Plus className="h-2.5 w-2.5" />
            追加
          </button>
        </div>
      </div>
      {hasCategories && uncategorized.length > 0 && (
        <CategoryDivider name="未分類" />
      )}
      {uncategorized.map((p) => (
        <PresetListItem
          key={p.id}
          preset={p}
          index={presets.indexOf(p)}
          checked={selectedIds.has(p.id)}
          onToggle={() => onToggle(p)}
          onEdit={() => onOpenEdit(p)}
          onReorder={(from, to) => onReorder(type, from, to)}
        />
      ))}
      {categorized.map(({ cat, items }) => (
        <div key={cat.id}>
          <CategoryDivider name={cat.name} />
          {items.map((p) => (
            <PresetListItem
              key={p.id}
              preset={p}
              index={presets.indexOf(p)}
              checked={selectedIds.has(p.id)}
              onToggle={() => onToggle(p)}
              onEdit={() => onOpenEdit(p)}
              onReorder={(from, to) => onReorder(type, from, to)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Character (region) editor tab
// ---------------------------------------------------------------------------

export default function CharacterTab({
  region,
  index,
  physicalPresets,
  posePresets,
  otherPresets,
  presetCategories,
  onUpdate,
  onAddPreset,
  onUpdatePreset,
  onRemovePreset,
  onReorderPresets,
  onAddCategory,
  onRenameCategory,
  onRemoveCategory,
}: {
  region: CoupleRegion;
  index: number;
  physicalPresets: Preset[];
  posePresets: Preset[];
  otherPresets: Preset[];
  presetCategories: PresetCategory[];
  onUpdate: (updates: Partial<CoupleRegion>) => void;
  onAddPreset: (preset: Omit<Preset, "id">) => void;
  onUpdatePreset: (id: string, updates: Partial<Preset>) => void;
  onRemovePreset: (id: string) => void;
  onReorderPresets: (type: PresetType, from: number, to: number) => void;
  onAddCategory: (name: string) => void;
  onRenameCategory: (id: string, name: string) => void;
  onRemoveCategory: (id: string) => void;
}) {
  const col = REGION_COLORS[index % REGION_COLORS.length];
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

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2">
        <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${col.bar}`} />
        <Input
          value={region.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-6 text-xs"
          placeholder="キャラA"
        />
      </div>

      <LoraSection
        lora={region.lora ?? undefined}
        onChange={(lora) => onUpdate({ lora: lora ?? null })}
      />

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          プリセット（チェックしたものを自動追加）
        </Label>
        {(() => {
          const selectedIds = new Set(region.selectedPresetIds);
          const onToggle = (preset: Preset) => {
            const next = new Set(selectedIds);
            if (next.has(preset.id)) next.delete(preset.id);
            else next.add(preset.id);
            onUpdate({ selectedPresetIds: [...next] });
          };
          return (
            <>
              <PresetListSection
                presets={physicalPresets}
                type="physical"
                label="身体的特徴"
                presetCategories={presetCategories}
                selectedIds={selectedIds}
                onToggle={onToggle}
                onOpenAdd={openAdd}
                onOpenEdit={openEdit}
                onReorder={onReorderPresets}
                onOpenCategoryManager={() => setCategoryManagerOpen(true)}
              />
              <PresetListSection
                presets={posePresets}
                type="pose"
                label="ポーズ"
                presetCategories={presetCategories}
                selectedIds={selectedIds}
                onToggle={onToggle}
                onOpenAdd={openAdd}
                onOpenEdit={openEdit}
                onReorder={onReorderPresets}
                onOpenCategoryManager={() => setCategoryManagerOpen(true)}
              />
              <PresetListSection
                presets={otherPresets}
                type="other"
                label="その他"
                presetCategories={presetCategories}
                selectedIds={selectedIds}
                onToggle={onToggle}
                onOpenAdd={openAdd}
                onOpenEdit={openEdit}
                onReorder={onReorderPresets}
                onOpenCategoryManager={() => setCategoryManagerOpen(true)}
              />
            </>
          );
        })()}
      </div>

      <Separator />

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            キャラプロンプト
          </Label>
          <button
            className="text-[10px] text-muted-foreground hover:text-destructive"
            onClick={() => onUpdate({ prompt: "" })}
          >
            クリア
          </button>
        </div>
        <Textarea
          value={region.prompt}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
          className="font-mono text-xs"
          rows={4}
          placeholder="1girl, long hair, blonde hair,"
        />
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
