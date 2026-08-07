import { FIXED_POSITIVE_PREFIX } from "./config";
import type { LoraEntry, Preset, PresetCategory } from "./comfy-types";

export function buildOutputPrefix(loraName: string, filePrefix?: string): string {
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const safeName = (loraName || "no-lora")
    .replace(/[/\\:*?"<>|\x00-\x1f]/g, "_")
    .trim()
    .substring(0, 40);
  const safePrefix = filePrefix
    ? filePrefix.replace(/[/\\:*?"<>|\x00-\x1f]/g, "_").trim().substring(0, 40)
    : "out";
  return `${dateStr}-${safeName}/${safePrefix}`;
}

function pushPreset(parts: string[], preset: Preset) {
  if (preset.prompt.trim()) parts.push(preset.prompt);
  if (preset.lora?.triggerWords?.trim())
    parts.push(preset.lora.triggerWords.trim());
}

export function assemblePositivePrompt({
  variableLora,
  fixedLoras = [],
  selectedPhysicalPresets,
  selectedCountPreset,
  selectedPosePreset,
  selectedScenePreset,
  selectedOtherPresets,
  additionalPrompt,
  fixedPrefix = FIXED_POSITIVE_PREFIX,
}: {
  variableLora: LoraEntry | null;
  fixedLoras?: LoraEntry[];
  selectedPhysicalPresets: Preset[];
  selectedCountPreset: Preset | null;
  selectedPosePreset: Preset | null;
  selectedScenePreset: Preset | null;
  selectedOtherPresets: Preset[];
  additionalPrompt: string;
  fixedPrefix?: string;
}): string {
  const parts: string[] = [fixedPrefix];

  for (const lora of fixedLoras) {
    if (lora.triggerWords?.trim()) parts.push(lora.triggerWords.trim());
  }

  if (variableLora?.triggerWords?.trim()) {
    parts.push(variableLora.triggerWords.trim());
  }

  for (const p of selectedPhysicalPresets) pushPreset(parts, p);
  if (selectedCountPreset) pushPreset(parts, selectedCountPreset);
  if (selectedPosePreset) pushPreset(parts, selectedPosePreset);
  if (selectedScenePreset) pushPreset(parts, selectedScenePreset);
  for (const p of selectedOtherPresets) pushPreset(parts, p);

  if (additionalPrompt.trim()) {
    parts.push(additionalPrompt.trim());
  }

  return parts.join("\n\n");
}

export function collectPresetLoras(presets: Preset[]): LoraEntry[] {
  return presets.flatMap((p) => (p.lora ? [p.lora] : []));
}

/** 未分類を先頭に出してからカテゴリ別にグルーピングする(空カテゴリは除外)。 */
export function groupPresetsByCategory(
  presets: Preset[],
  categories: PresetCategory[],
): {
  uncategorized: Preset[];
  categorized: { cat: PresetCategory; items: Preset[] }[];
  hasCategories: boolean;
} {
  const uncategorized = presets.filter((p) => !p.category);
  const categorized = categories
    .map((cat) => ({
      cat,
      items: presets.filter((p) => p.category === cat.id),
    }))
    .filter(({ items }) => items.length > 0);
  return { uncategorized, categorized, hasCategories: categorized.length > 0 };
}
