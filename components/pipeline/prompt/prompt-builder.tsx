"use client";
import { useState } from "react";
import {
  type Preset,
  type LoraEntry,
  type PresetCategory,
  assemblePositivePrompt,
  isCommentLine,
} from "@/lib/comfy";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronDown } from "lucide-react";
import TagAutocompleteTextarea from "@/components/common/tag-autocomplete-textarea";
import { Label } from "@/components/ui/label";
import {
  PresetModal,
  CategoryManagerModal,
  type PresetType,
} from "@/components/pipeline/prompt/preset-modal";
import PresetSection from "@/components/pipeline/prompt/preset-section";

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

  return (
    <div className="space-y-3">
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
          style={{
            minHeight: "60px",
            fontSize: "10px",
            fontFamily: "monospace",
          }}
        />
      </div>

      <Separator />
      <PresetSection
        label="身体的特徴"
        badge="複数可"
        type="physical"
        presets={physicalPresets}
        selectedIds={selectedPhysicalIds}
        selectionType="checkbox"
        onSelect={onTogglePhysical}
        sectionId="p-physical"
        presetCategories={presetCategories}
        onOpenAdd={openAdd}
        onOpenEdit={openEdit}
        onReorderPresets={onReorderPresets}
        onOpenCategoryManager={() => setCategoryManagerOpen(true)}
      />

      <Separator />
      <PresetSection
        label="人数"
        badge="1択"
        type="count"
        presets={countPresets}
        selectedIds={selectedCountId ? [selectedCountId] : []}
        selectionType="radio"
        onSelect={(id) => onSelectCount(selectedCountId === id ? null : id)}
        sectionId="p-count"
        presetCategories={presetCategories}
        onOpenAdd={openAdd}
        onOpenEdit={openEdit}
        onReorderPresets={onReorderPresets}
        onOpenCategoryManager={() => setCategoryManagerOpen(true)}
      />

      <Separator />
      <PresetSection
        label="ポーズ"
        badge="1択"
        type="pose"
        presets={posePresets}
        selectedIds={selectedPoseId ? [selectedPoseId] : []}
        selectionType="radio"
        onSelect={(id) => onSelectPose(selectedPoseId === id ? null : id)}
        sectionId="p-pose"
        presetCategories={presetCategories}
        onOpenAdd={openAdd}
        onOpenEdit={openEdit}
        onReorderPresets={onReorderPresets}
        onOpenCategoryManager={() => setCategoryManagerOpen(true)}
      />

      <Separator />
      <PresetSection
        label="シーン"
        badge="1択"
        type="scene"
        presets={scenePresets}
        selectedIds={selectedSceneId ? [selectedSceneId] : []}
        selectionType="radio"
        onSelect={(id) => onSelectScene(selectedSceneId === id ? null : id)}
        sectionId="p-scene"
        presetCategories={presetCategories}
        onOpenAdd={openAdd}
        onOpenEdit={openEdit}
        onReorderPresets={onReorderPresets}
        onOpenCategoryManager={() => setCategoryManagerOpen(true)}
      />

      <Separator />
      <PresetSection
        label="その他"
        badge="複数可"
        type="other"
        presets={otherPresets}
        selectedIds={selectedOtherIds}
        selectionType="checkbox"
        onSelect={onToggleOther}
        sectionId="p-other"
        presetCategories={presetCategories}
        onOpenAdd={openAdd}
        onOpenEdit={openEdit}
        onReorderPresets={onReorderPresets}
        onOpenCategoryManager={() => setCategoryManagerOpen(true)}
      />

      <Separator />

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
            {
              additionalPrompt
                .split("\n")
                .filter((s) => s.trim() && !isCommentLine(s)).length
            }
            行 —
            生成ごとに1行がランダム選択されます
          </p>
        )}
      </div>

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
