"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings2 } from "lucide-react";
import {
  type Preset,
  type PresetCategory,
  groupPresetsByCategory,
} from "@/lib/comfy";
import { type PresetType, TYPE_LABELS } from "@/components/preset-modal";
import CategoryDivider from "@/components/category-divider";
import DraggableItem from "@/components/draggable-preset-item";

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
      <span className="text-[10px] font-medium text-muted-foreground">
        {name}
      </span>
      <div className="flex-1 border-t border-dashed border-border/60" />
      {groupIds.length > 0 && (
        <button
          onClick={handleToggle}
          className={`shrink-0 rounded px-1 py-0.5 text-[9px] transition-colors ${
            anySelected
              ? "text-blue-500 hover:text-blue-700"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={
            anySelected
              ? "このカテゴリの選択を解除"
              : "このカテゴリをすべて選択"
          }
        >
          {anySelected ? (allSelected ? "全解除" : "解除") : "全選択"}
        </button>
      )}
    </div>
  );
}

export default function PresetSection({
  label,
  badge,
  type,
  presets,
  selectedIds,
  selectionType,
  onSelect,
  sectionId,
  presetCategories,
  onOpenAdd,
  onOpenEdit,
  onReorderPresets,
  onOpenCategoryManager,
}: {
  label: string;
  badge: string;
  type: PresetType;
  presets: Preset[];
  selectedIds: string[];
  selectionType: "radio" | "checkbox";
  onSelect: (id: string) => void;
  sectionId?: string;
  presetCategories: PresetCategory[];
  onOpenAdd: (type: PresetType) => void;
  onOpenEdit: (preset: Preset) => void;
  onReorderPresets: (type: PresetType, from: number, to: number) => void;
  onOpenCategoryManager: () => void;
}) {
  const { uncategorized, categorized, hasCategories } = groupPresetsByCategory(
    presets,
    presetCategories,
  );

  return (
    <div id={sectionId}>
      <div className="mb-1 flex items-center justify-between">
        <SectionHeader label={label} badge={badge} />
        <button
          onClick={onOpenCategoryManager}
          className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          title="カテゴリ管理"
          aria-label="カテゴリ管理"
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
            onEdit={() => onOpenEdit(preset)}
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
                onEdit={() => onOpenEdit(preset)}
                onReorder={(from, to) => onReorderPresets(type, from, to)}
              />
            ))}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-full gap-1 text-xs"
          onClick={() => onOpenAdd(type)}
        >
          <Plus className="h-3 w-3" />
          {TYPE_LABELS[type]}追加
        </Button>
      </div>
    </div>
  );
}
