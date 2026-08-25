"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ResizablePanel } from "@/components/ui/resizable";
import LoraPanel from "@/components/pipeline/lora/lora-panel";
import PromptBuilder from "@/components/pipeline/prompt/prompt-builder";
import SamplerSettings from "@/components/pipeline/sampler-settings";
import TagSettings from "@/components/pipeline/prompt/tag-settings";
import CouplePanel from "@/components/pipeline/couple/couple-panel";
import Section from "@/components/pipeline/section";
import { type LeftSectionId } from "@/components/pipeline/left-icon-nav";
import type { PipelineHook } from "@/hooks/pipeline/use-pipeline";
import type { CoupleHook } from "@/hooks/pipeline/use-couple";

export interface LeftPanelProps {
  pipeline: PipelineHook;
  couple: CoupleHook;
  onLeftTabModeChange: (mode: "normal" | "couple") => void;
  registerSectionRef: (
    id: LeftSectionId,
  ) => (el: HTMLDivElement | null) => void;
  selectedCount: number;
  onOpenModelManager: () => void;
}

export default function LeftPanel({
  pipeline,
  couple,
  onLeftTabModeChange,
  registerSectionRef,
  selectedCount,
  onOpenModelManager,
}: LeftPanelProps) {
  const {
    fixedLoras,
    addFixedLora,
    updateFixedLora,
    removeFixedLora,
    variableLoras,
    selectedVariableLora,
    setSelectedVariableLora,
    addVariableLora,
    updateVariableLora,
    removeVariableLora,
    setVariableLoraArchived,
    physicalPresets,
    scenePresets,
    countPresets,
    posePresets,
    otherPresets,
    selectedPhysicalIds,
    togglePhysicalPreset,
    selectedSceneId,
    setSelectedSceneId,
    selectedCountId,
    selectCountPreset,
    selectedPoseId,
    selectPosePreset,
    reorderPresets,
    selectedOtherIds,
    toggleOtherPreset,
    additionalPrompt,
    setAdditionalPrompt,
    negativePrompt,
    setNegativePrompt,
    fixedTags,
    setFixedTags,
    resetFixedTags,
    addPreset,
    updatePreset,
    removePreset,
    presetCategories,
    addCategory,
    renameCategory,
    removeCategory,
    settings,
    setSettings,
    variationEnabled,
    setVariationEnabled,
    variationTags,
    setVariationTags,
    additionalPromptMode,
    setAdditionalPromptMode,
    panelSizes,
    setPanelSizes,
  } = pipeline;

  return (
    <ResizablePanel
      id="left"
      defaultSize={`${panelSizes["left"]}%`}
      minSize="15%"
      maxSize="45%"
      className="flex flex-col border-r"
      onResize={(size) =>
        setPanelSizes({
          ...panelSizes,
          left: Math.round(size.asPercentage),
        })
      }
    >
      <Tabs
        defaultValue="normal"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        onValueChange={(v) => onLeftTabModeChange(v as "normal" | "couple")}
      >
        <TabsList className="m-2 mb-0 shrink-0">
          <TabsTrigger value="normal" className="flex-1 text-xs">
            通常
          </TabsTrigger>
          <TabsTrigger value="couple" className="flex-1 text-xs">
            マルチキャラ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="normal" className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-3">
            <div ref={registerSectionRef("lora")}>
              <Section
                title="LoRA設定"
                badge={selectedVariableLora ? "1選択中" : undefined}
              >
                <LoraPanel
                  fixedLoras={fixedLoras}
                  onAddFixedLora={addFixedLora}
                  onUpdateFixedLora={updateFixedLora}
                  onRemoveFixedLora={removeFixedLora}
                  variableLoras={variableLoras}
                  selectedVariableLora={selectedVariableLora}
                  onSelectVariableLora={setSelectedVariableLora}
                  onAddVariableLora={addVariableLora}
                  onUpdateVariableLora={updateVariableLora}
                  onRemoveVariableLora={removeVariableLora}
                  onArchiveVariableLora={setVariableLoraArchived}
                />
              </Section>
            </div>

            <div ref={registerSectionRef("prompt")}>
              <Section
                title="プロンプト"
                badge={selectedCount > 0 ? `${selectedCount}選択` : undefined}
              >
                <PromptBuilder
                  variableLora={selectedVariableLora}
                  physicalPresets={physicalPresets}
                  scenePresets={scenePresets}
                  countPresets={countPresets}
                  posePresets={posePresets}
                  otherPresets={otherPresets}
                  selectedPhysicalIds={selectedPhysicalIds}
                  selectedSceneId={selectedSceneId}
                  selectedCountId={selectedCountId}
                  selectedPoseId={selectedPoseId}
                  selectedOtherIds={selectedOtherIds}
                  additionalPrompt={additionalPrompt}
                  additionalPromptMode={additionalPromptMode}
                  negativePrompt={negativePrompt}
                  onTogglePhysical={togglePhysicalPreset}
                  onSelectScene={setSelectedSceneId}
                  onSelectCount={selectCountPreset}
                  onSelectPose={selectPosePreset}
                  onToggleOther={toggleOtherPreset}
                  onSetAdditional={setAdditionalPrompt}
                  onSetAdditionalMode={setAdditionalPromptMode}
                  onSetNegative={setNegativePrompt}
                  fixedTags={fixedTags}
                  onSetFixedTags={setFixedTags}
                  onResetFixedTags={resetFixedTags}
                  onAddPreset={addPreset}
                  onUpdatePreset={updatePreset}
                  onRemovePreset={removePreset}
                  onReorderPresets={reorderPresets}
                  presetCategories={presetCategories}
                  onAddCategory={addCategory}
                  onRenameCategory={renameCategory}
                  onRemoveCategory={removeCategory}
                />
              </Section>
            </div>

            <div ref={registerSectionRef("sampler")}>
              <Section title="サンプラー設定" defaultOpen={false}>
                <SamplerSettings
                  settings={settings}
                  onChange={setSettings}
                  onOpenModelManager={onOpenModelManager}
                />
              </Section>
            </div>

            <div ref={registerSectionRef("variation")}>
              <Section
                title="ランダム構図"
                defaultOpen={false}
                badge={variationEnabled ? "ON" : undefined}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={variationEnabled}
                      onCheckedChange={setVariationEnabled}
                      id="variation-toggle"
                    />
                    <Label
                      htmlFor="variation-toggle"
                      className="cursor-pointer text-xs"
                    >
                      ランダム構図
                      {variationEnabled && (
                        <span className="text-primary">が有効</span>
                      )}
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    有効にすると、各枚ごとにランダムな構図タグが追加されます。1タグ1行で入力。
                  </p>
                  <Textarea
                    value={variationTags.join("\n")}
                    onChange={(e) =>
                      setVariationTags(
                        e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                    rows={7}
                    className="font-mono text-xs"
                    placeholder="from above,&#10;from below,&#10;dutch angle,"
                  />
                </div>
              </Section>
            </div>

            <div ref={registerSectionRef("tagdb")}>
              <Section title="タグDB設定" defaultOpen={false}>
                <TagSettings />
              </Section>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="couple" className="min-h-0 flex-1 overflow-y-auto">
          <div ref={registerSectionRef("couple-top")}>
            <CouplePanel
              couple={couple}
              fixedTags={fixedTags}
              negativePrompt={negativePrompt}
              setNegativePrompt={setNegativePrompt}
              physicalPresets={physicalPresets}
              posePresets={posePresets}
              otherPresets={otherPresets}
              countPresets={countPresets}
              scenePresets={scenePresets}
              onAddPreset={addPreset}
              onUpdatePreset={updatePreset}
              onRemovePreset={removePreset}
              onReorderPresets={reorderPresets}
              presetCategories={presetCategories}
              onAddCategory={addCategory}
              onRenameCategory={renameCategory}
              onRemoveCategory={removeCategory}
            />
          </div>
        </TabsContent>
      </Tabs>
    </ResizablePanel>
  );
}
