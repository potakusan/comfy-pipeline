"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  REGION_COLORS,
  buildCouplePrompt,
  applySelectedPresets,
} from "@/lib/comfy/couple";
import { type Preset, type PresetCategory } from "@/lib/comfy";
import { type CoupleHook } from "@/hooks/pipeline/use-couple";
import ConfigSelector from "@/components/pipeline/couple/config-selector";
import CharacterTab from "@/components/pipeline/couple/character-tab";
import BaseTab from "@/components/pipeline/couple/base-tab";

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

  const [innerTab, setInnerTab] = useState("base");

  const validCharTabs = activeConfig.regions.map((_, i) => `char-${i}`);
  const safeInnerTab =
    innerTab === "base" || validCharTabs.includes(innerTab) ? innerTab : "base";

  const cn = activeConfig.controlNet;
  const allCharPresets = [...physicalPresets, ...posePresets, ...otherPresets];
  const effectiveRegions = activeConfig.regions.map((r) =>
    applySelectedPresets(r, allCharPresets),
  );
  const selectedCount =
    countPresets.find((p) => p.id === selectedNormalCountId) ?? null;
  const selectedScene =
    scenePresets.find((p) => p.id === selectedNormalSceneId) ?? null;
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

  const handleRemoveLastCharacter = () => {
    const idx = validCharTabs.indexOf(safeInnerTab);
    const target = idx >= 0 ? idx : activeConfig.regions.length - 1;
    removeRegion(target);
    setInnerTab("base");
  };

  return (
    <div className="flex flex-col space-y-2 py-2">
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

        <TabsContent value="base" className="px-3">
          <BaseTab
            activeConfig={activeConfig}
            fixedTags={fixedTags}
            negativePrompt={negativePrompt}
            onNegativePromptChange={setNegativePrompt}
            countPicker={{
              presets: countPresets,
              selectedId: selectedNormalCountId,
              onSelect: setSelectedNormalCountId,
            }}
            scenePicker={{
              presets: scenePresets,
              selectedId: selectedNormalSceneId,
              onSelect: setSelectedNormalSceneId,
            }}
            onAddRegion={addRegion}
            onRemoveLastCharacter={handleRemoveLastCharacter}
            onUpdateBasePrompt={updateBasePrompt}
            onUpdateRegion={updateRegion}
            onUpdateControlNet={updateControlNet}
            assembledPrompt={assembledPrompt}
            effectiveRegions={effectiveRegions}
          />
        </TabsContent>

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
