// クライアント(設定画面)とサーバーの両方から使うため、fs等のサーバー専用モジュールには依存させない。

export type OutputFormat = "png" | "jpg" | "webp"

export interface OutputImageSettings {
  format: OutputFormat
  quality: number
  lossless: boolean
  chroma444: boolean
}

export const DEFAULT_OUTPUT_IMAGE_SETTINGS: OutputImageSettings = {
  format: "jpg",
  quality: 95,
  lossless: false,
  chroma444: true,
}

/** 未設定・不正値は既定値(JPG 品質95・4:4:4)に丸める。 */
export function normalizeOutputImageSettings(input: {
  format?: unknown
  quality?: unknown
  lossless?: unknown
  chroma444?: unknown
}): OutputImageSettings {
  const d = DEFAULT_OUTPUT_IMAGE_SETTINGS
  const q = Number(input.quality)
  return {
    format: input.format === "png" || input.format === "jpg" || input.format === "webp" ? input.format : d.format,
    quality: Number.isFinite(q) && q >= 1 && q <= 100 ? Math.round(q) : d.quality,
    lossless: typeof input.lossless === "boolean" ? input.lossless : d.lossless,
    chroma444: typeof input.chroma444 === "boolean" ? input.chroma444 : d.chroma444,
  }
}
