import type { ModelFamily } from "./comfy-types";

/** 系統ごとにファイルが分かれている同一スタイルのLoRA。名前がどれかに一致したら、現在の系統のファイルへ差し替える。 */
export const LORA_FAMILY_PAIRS: { label: string; files: Record<ModelFamily, string> }[] = [
  {
    label: "ai-styles-dump",
    files: {
      sdxl: "best_of_ai_styles_noob-eps-0.5_v2.217-edm2-pass",
      anima: "mixed_styles_anima-base1_v6",
    },
  },
];

const stem = (name: string) => name.replace(/\.safetensors$/, "");

/** ワークフローに入れるLoRAファイル名(拡張子なし)。ペア定義が無ければ元の名前のまま。 */
export function resolveLoraName(name: string, family: ModelFamily = "sdxl"): string {
  const pair = findLoraPair(name);
  return pair ? pair.files[family] : stem(name);
}

/** 系統別ペアに属するLoRAなら、そのラベルと現在の系統で使われるファイル名を返す(UIのバッジ用)。 */
export function describeLoraForFamily(
  name: string,
  family: ModelFamily = "sdxl",
): { label: string; file: string } | null {
  const pair = findLoraPair(name);
  return pair ? { label: pair.label, file: pair.files[family] } : null;
}

function findLoraPair(name: string) {
  const n = stem(name);
  return LORA_FAMILY_PAIRS.find((p) => Object.values(p.files).includes(n));
}
