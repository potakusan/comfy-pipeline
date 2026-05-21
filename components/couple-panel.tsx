"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Settings2,
  Brush,
  FileImage,
} from "lucide-react";
import {
  type CoupleRegion,
  type CoupleConfig,
  REGION_COLORS,
  buildCouplePrompt,
  buildRegionPrompt,
  applySelectedPresets,
} from "@/lib/couple";
import { type Preset, type LoraEntry, type PresetCategory } from "@/lib/comfy";
import { type CoupleHook } from "@/hooks/use-couple";
import { LoraSection } from "@/components/lora-section";
import {
  PresetModal,
  CategoryManagerModal,
  type PresetType,
} from "@/components/preset-modal";
import CompositionDialog from "@/components/composition-dialog";

// ---------------------------------------------------------------------------
// Config selector dropdown
// ---------------------------------------------------------------------------

function ConfigSelector({
  configs,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  configs: CoupleConfig[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<CoupleConfig | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const active = configs.find((c) => c.id === activeId) ?? configs[0];

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 justify-between gap-1 truncate text-xs"
          >
            <span className="truncate">{active?.name ?? "設定を選択"}</span>
            <ChevronDown className="h-3 w-3 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {configs.map((c) => (
            <DropdownMenuItem
              key={c.id}
              className="flex items-center gap-2 text-xs"
              onSelect={() => onSelect(c.id)}
            >
              {c.id === activeId ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <span className="h-3 w-3 shrink-0" />
              )}
              <span className="flex-1 truncate">{c.name}</span>
              <button
                className="p-0.5 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameTarget(c);
                  setRenameDraft(c.name);
                  setRenameOpen(true);
                }}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-xs"
            onSelect={() => setCreateOpen(true)}
          >
            <Plus className="h-3 w-3" />
            新規設定を作成
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        disabled={configs.length <= 1}
        title="この設定を削除"
        onClick={() => {
          if (confirm(`「${active?.name}」を削除しますか？`))
            onDelete(activeId);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">新規設定を作成</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="設定名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                onCreate(newName.trim());
                setNewName("");
                setCreateOpen(false);
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              size="sm"
              disabled={!newName.trim()}
              onClick={() => {
                onCreate(newName.trim());
                setNewName("");
                setCreateOpen(false);
              }}
            >
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">設定名を変更</DialogTitle>
          </DialogHeader>
          <Input
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameDraft.trim() && renameTarget) {
                onRename(renameTarget.id, renameDraft.trim());
                setRenameOpen(false);
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              size="sm"
              disabled={!renameDraft.trim()}
              onClick={() => {
                if (renameTarget) onRename(renameTarget.id, renameDraft.trim());
                setRenameOpen(false);
              }}
            >
              変更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category divider
// ---------------------------------------------------------------------------

function CategoryDivider({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="text-[10px] font-medium text-muted-foreground">
        {name}
      </span>
      <div className="flex-1 border-t border-dashed border-border/60" />
    </div>
  );
}

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
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
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
        if (!isNaN(from) && from !== index) onReorder(from, index);
        setIsOver(false);
      }}
      onDragEnd={() => setIsOver(false)}
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
  const uncategorized = presets.filter((p) => !p.category);
  const categorized = presetCategories
    .map((cat) => ({
      cat,
      items: presets.filter((p) => p.category === cat.id),
    }))
    .filter(({ items }) => items.length > 0);
  const hasCategories = categorized.length > 0;

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

function CharacterTab({
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
      {/* Name */}
      <div className="flex items-center gap-2">
        <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${col.bar}`} />
        <Input
          value={region.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-6 text-xs"
          placeholder="キャラA"
        />
      </div>

      {/* LoRA */}
      <LoraSection
        lora={region.lora ?? undefined}
        onChange={(lora) => onUpdate({ lora: lora ?? null })}
      />

      <Separator />

      {/* Preset lists — checkbox auto-include */}
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

      {/* Character prompt textarea */}
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

// ---------------------------------------------------------------------------
// Prompt preview (collapsible)
// ---------------------------------------------------------------------------

function PromptPreview({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border bg-muted/30">
      <button
        className="flex w-full items-center justify-between px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <span>生成プロンプトプレビュー</span>
        {open ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
      {open && (
        <Textarea
          readOnly
          value={prompt}
          className="rounded-t-none border-0 border-t font-mono text-[10px] text-muted-foreground"
          rows={8}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CouplePanelProps & component
// ---------------------------------------------------------------------------

export interface CouplePanelProps {
  couple: CoupleHook;
  fixedTags: string;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  physicalPresets: Preset[];
  posePresets: Preset[];
  otherPresets: Preset[];
  countPresets: Preset[];
  scenePresets: Preset[];
  presetCategories: PresetCategory[];
  onAddPreset: (preset: Omit<Preset, "id">) => void;
  onUpdatePreset: (id: string, updates: Partial<Preset>) => void;
  onRemovePreset: (id: string) => void;
  onReorderPresets: (
    type: "physical" | "count" | "pose" | "scene" | "other",
    from: number,
    to: number,
  ) => void;
  onAddCategory: (name: string) => void;
  onRenameCategory: (id: string, name: string) => void;
  onRemoveCategory: (id: string) => void;
}

export default function CouplePanel({
  couple,
  fixedTags,
  negativePrompt,
  setNegativePrompt,
  physicalPresets,
  posePresets,
  otherPresets,
  countPresets,
  scenePresets,
  presetCategories,
  onAddPreset,
  onUpdatePreset,
  onRemovePreset,
  onReorderPresets,
  onAddCategory,
  onRenameCategory,
  onRemoveCategory,
}: CouplePanelProps) {
  const {
    configs,
    activeConfig,
    activeConfigId,
    setActiveConfigId,
    selectedNormalCountId,
    setSelectedNormalCountId,
    selectedNormalSceneId,
    setSelectedNormalSceneId,
    createConfig,
    deleteConfig,
    renameConfig,
    updateBasePrompt,
    updateRegion,
    addRegion,
    removeRegion,
    updateControlNet,
  } = couple;

  const [compositionOpen, setCompositionOpen] = useState(false);
  const [innerTab, setInnerTab] = useState("base");
  const selectedCount =
    countPresets.find((p) => p.id === selectedNormalCountId) ?? null;
  const selectedScene =
    scenePresets.find((p) => p.id === selectedNormalSceneId) ?? null;

  const validCharTabs = activeConfig.regions.map((_, i) => `char-${i}`);
  const safeInnerTab =
    innerTab === "base" || validCharTabs.includes(innerTab) ? innerTab : "base";

  const cn = activeConfig.controlNet;
  const allCharPresets = [...physicalPresets, ...posePresets, ...otherPresets];
  const effectiveRegions = activeConfig.regions.map((r) =>
    applySelectedPresets(r, allCharPresets),
  );
  const assembledPrompt = cn.enabled
    ? // Color-mask mode: only the base prompt goes to the KSampler positive
      [
        fixedTags,
        activeConfig.basePrompt,
        selectedCount?.prompt ?? "",
        selectedScene?.prompt ?? "",
      ]
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n\n")
    : buildCouplePrompt({
        fixedTags,
        basePrompt: activeConfig.basePrompt,
        countPrompt: selectedCount?.prompt ?? "",
        scenePrompt: selectedScene?.prompt ?? "",
        regions: effectiveRegions,
      });

  return (
    <div className="flex flex-col space-y-2 py-2">
      {/* Config selector */}
      <div className="px-3">
        <ConfigSelector
          configs={configs}
          activeId={activeConfigId}
          onSelect={setActiveConfigId}
          onCreate={createConfig}
          onRename={renameConfig}
          onDelete={deleteConfig}
        />
      </div>

      {/* Inner tabs: ベース | キャラA | キャラB | ... */}
      <Tabs
        value={safeInnerTab}
        onValueChange={setInnerTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="px-3">
          <TabsList className="h-7 w-full">
            <TabsTrigger value="base" className="flex-1 text-[10px]">
              ベース
            </TabsTrigger>
            {activeConfig.regions.map((r, i) => {
              const col = REGION_COLORS[i % REGION_COLORS.length];
              return (
                <TabsTrigger
                  key={r.id}
                  value={`char-${i}`}
                  className="flex-1 text-[10px]"
                >
                  <span
                    className={`mr-0.5 inline-block h-1.5 w-1.5 rounded-full ${col.bar}`}
                  />
                  {r.name}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* ===== BASE TAB ===== */}
        <TabsContent value="base" className="px-3">
          <div className="space-y-3">
            {/* Character list (add/remove) */}
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                キャラクター
              </Label>
              <div className="flex gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground"
                  onClick={addRegion}
                  disabled={activeConfig.regions.length >= 5}
                  title="キャラを追加"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const idx = validCharTabs.indexOf(safeInnerTab);
                    const target =
                      idx >= 0 ? idx : activeConfig.regions.length - 1;
                    removeRegion(target);
                    setInnerTab("base");
                  }}
                  disabled={activeConfig.regions.length <= 1}
                  title="最後のキャラを削除"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Fixed tags from normal mode (read-only) */}
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                固定タグ（通常モードと共有）
              </Label>
              <Textarea
                readOnly
                value={fixedTags}
                className="cursor-not-allowed font-mono text-[10px] text-muted-foreground opacity-60"
                rows={2}
              />
            </div>

            {/* Couple-specific base prompt */}
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                マルチキャラ専用ベースプロンプト
              </Label>
              <Textarea
                value={activeConfig.basePrompt}
                onChange={(e) => updateBasePrompt(e.target.value)}
                className="font-mono text-xs"
                rows={4}
                placeholder="2girls, holding hands,"
              />
            </div>

            <Separator />

            {/* Count presets */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                人数
                {selectedCount && (
                  <Badge variant="secondary" className="ml-1.5 text-[9px]">
                    {selectedCount.name}
                  </Badge>
                )}
              </Label>
              <div className="flex flex-wrap gap-1">
                {countPresets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedNormalCountId(
                        selectedNormalCountId === p.id ? null : p.id,
                      )
                    }
                    className={`flex h-7 items-center rounded-md border px-2 text-[11px] font-medium transition-colors ${
                      selectedNormalCountId === p.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Scene presets */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                シーン
                {selectedScene && (
                  <Badge variant="secondary" className="ml-1.5 text-[9px]">
                    {selectedScene.name}
                  </Badge>
                )}
              </Label>
              <div className="flex flex-wrap gap-1">
                {scenePresets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedNormalSceneId(
                        selectedNormalSceneId === p.id ? null : p.id,
                      )
                    }
                    className={`flex h-7 items-center rounded-md border px-2 text-[11px] font-medium transition-colors ${
                      selectedNormalSceneId === p.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Negative prompt */}
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                ネガティブプロンプト
              </Label>
              <Textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                className="font-mono text-xs"
                rows={3}
              />
            </div>

            <Separator />

            {/* ControlNet / Color-mask section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  ControlNet + カラーマスク
                </Label>
                <Switch
                  checked={activeConfig.controlNet.enabled}
                  onCheckedChange={(v) => updateControlNet({ enabled: v })}
                  className="scale-75"
                />
              </div>

              {activeConfig.controlNet.enabled && (
                <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                  {/* Open drawing editor */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-full text-xs"
                    onClick={() => setCompositionOpen(true)}
                  >
                    <Brush className="mr-1.5 h-3 w-3" />
                    構図エディタを開く
                  </Button>

                  {/* Color hex per region */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">
                      カラーマップの色 (各キャラの塗り色と一致させてください)
                    </span>
                    {activeConfig.regions.map((r, i) => (
                      <div key={r.id} className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 shrink-0 rounded border"
                          style={{ backgroundColor: r.colorHex }}
                        />
                        <span className="w-16 truncate text-[10px]">
                          {r.name}
                        </span>
                        <input
                          type="color"
                          value={r.colorHex}
                          onChange={(e) =>
                            updateRegion(i, { colorHex: e.target.value })
                          }
                          className="h-5 w-8 cursor-pointer rounded border"
                        />
                        <Input
                          value={r.colorHex}
                          onChange={(e) =>
                            updateRegion(i, { colorHex: e.target.value })
                          }
                          className="h-5 flex-1 font-mono text-[10px]"
                          maxLength={7}
                        />
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Active image names */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileImage className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        ポーズ:
                      </span>
                      <span className="truncate font-mono text-[10px] text-foreground">
                        {activeConfig.controlNet.poseImageName ?? "未設定"}
                      </span>
                      {activeConfig.controlNet.poseImageName && (
                        <button
                          className="text-[9px] text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            updateControlNet({ poseImageName: null })
                          }
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <FileImage className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        カラーマップ:
                      </span>
                      <span className="truncate font-mono text-[10px] text-foreground">
                        {activeConfig.controlNet.colorMapImageName ?? "未設定"}
                      </span>
                      {activeConfig.controlNet.colorMapImageName && (
                        <button
                          className="text-[9px] text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            updateControlNet({ colorMapImageName: null })
                          }
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* ControlNet model */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      ControlNetモデル
                    </Label>
                    <Input
                      value={activeConfig.controlNet.controlNetModel}
                      onChange={(e) =>
                        updateControlNet({ controlNetModel: e.target.value })
                      }
                      className="h-6 font-mono text-[10px]"
                      placeholder="illustriousXL_v10.safetensors"
                    />
                  </div>

                  {/* Strength / range */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        強度
                      </Label>
                      <div className="flex items-center gap-1">
                        <Slider
                          value={[activeConfig.controlNet.strength]}
                          onValueChange={([v]) =>
                            updateControlNet({ strength: v })
                          }
                          min={0}
                          max={3}
                          step={0.05}
                          className="flex-1"
                        />
                        <span className="w-7 text-right font-mono text-[10px]">
                          {activeConfig.controlNet.strength.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        開始
                      </Label>
                      <div className="flex items-center gap-1">
                        <Slider
                          value={[activeConfig.controlNet.startPercent]}
                          onValueChange={([v]) =>
                            updateControlNet({ startPercent: v })
                          }
                          min={0}
                          max={1}
                          step={0.05}
                          className="flex-1"
                        />
                        <span className="w-7 text-right font-mono text-[10px]">
                          {activeConfig.controlNet.startPercent.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        終了
                      </Label>
                      <div className="flex items-center gap-1">
                        <Slider
                          value={[activeConfig.controlNet.endPercent]}
                          onValueChange={([v]) =>
                            updateControlNet({ endPercent: v })
                          }
                          min={0}
                          max={1}
                          step={0.05}
                          className="flex-1"
                        />
                        <span className="w-7 text-right font-mono text-[10px]">
                          {activeConfig.controlNet.endPercent.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Prompt preview */}
            <PromptPreview prompt={assembledPrompt} />
            {cn.enabled && (
              <div className="space-y-1 rounded-md border bg-muted/20 px-2.5 py-2">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  各キャラプロンプト（RegionalConditioningColorMask）
                </span>
                {effectiveRegions.map((r) => (
                  <div key={r.id} className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: r.colorHex }}
                      />
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {r.name}
                      </span>
                    </div>
                    <Textarea
                      readOnly
                      value={buildRegionPrompt(r) || "（未設定）"}
                      className="font-mono text-[10px] text-muted-foreground/80 cursor-default resize-none"
                      rows={3}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Composition editor dialog */}
            <CompositionDialog
              open={compositionOpen}
              onOpenChange={setCompositionOpen}
              regions={activeConfig.regions}
              currentPoseImageName={activeConfig.controlNet.poseImageName}
              currentColorMapImageName={
                activeConfig.controlNet.colorMapImageName
              }
              onApplyPose={(filename) =>
                updateControlNet({ poseImageName: filename })
              }
              onApplyColorMap={(filename) =>
                updateControlNet({ colorMapImageName: filename })
              }
            />
          </div>
        </TabsContent>

        {/* ===== CHARACTER TABS ===== */}
        {activeConfig.regions.map((r, i) => (
          <TabsContent key={r.id} value={`char-${i}`} className="px-3">
            <CharacterTab
              region={r}
              index={i}
              physicalPresets={physicalPresets}
              posePresets={posePresets}
              otherPresets={otherPresets}
              presetCategories={presetCategories}
              onUpdate={(updates) => updateRegion(i, updates)}
              onAddPreset={onAddPreset}
              onUpdatePreset={onUpdatePreset}
              onRemovePreset={onRemovePreset}
              onReorderPresets={onReorderPresets}
              onAddCategory={onAddCategory}
              onRenameCategory={onRenameCategory}
              onRemoveCategory={onRemoveCategory}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
