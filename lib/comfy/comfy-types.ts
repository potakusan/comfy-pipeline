import type {
  VariableBindings,
  VariableDefs,
  PromptReplacement,
} from "./prompt-variables";

export interface PresetCategory {
  id: string;
  name: string;
}

export interface LoraEntry {
  name: string;
  strength: number;
  clipStrength: number;
  triggerWords: string;
  /** true = 実LoRAファイルを適用せず、プロンプト/フォルダ分け用のタイトルとしてのみ使う */
  isPromptOnly?: boolean;
  /** true = 可変LoRAの下部アーカイブ欄に格納されている（通常リストやプリセット実行時の選択肢からは除外される） */
  isArchived?: boolean;
}

export interface GenerationSettings {
  checkpoint: string;
  upscaleModel: string;
  upscaleSteps: number;
  width: number;
  height: number;
  randomizeSeed: boolean;
  seed: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  denoise: number;
  /** アップスケール2段目(ksamp2)のseedを固定したい場合に指定する。省略時は生成のたびにランダムな値が使われる。 */
  upscaleSeed?: number;
}

export interface Preset {
  id: string;
  name: string;
  prompt: string;
  type: "physical" | "count" | "pose" | "scene" | "other";
  lora?: LoraEntry;
  /** "all" = use full prompt; "random" = pick one random line per generation */
  promptMode?: "all" | "random";
  category?: string; // PresetCategory.id
}

export type PresetType = Preset["type"];

export interface QueueItemBatchPresets {
  selectedPhysicals: Preset[];
  selectedCount: Preset | null;
  selectedPose: Preset | null;
  selectedScene: Preset | null;
  selectedOthers: Preset[];
}

export interface QueueItem {
  id: string;
  label: string;
  variableLora: LoraEntry | null;
  presetLoras: LoraEntry[];
  positivePrompt: string;
  /** assembled WITHOUT additionalPrompt — used as base for random mode */
  positivePromptBase: string;
  negativePrompt: string;
  settings: GenerationSettings;
  batchCount: number;
  /** ユーザーが指定した元の生成枚数。良品率調整やseedPoolの枚数不足等でbatchCountが切り詰められた場合のみ、両者が異なる。 */
  requestedBatchCount?: number;
  /** 一括キュープリセットから生成された場合のBatchPreset.id */
  batchPresetId?: string;
  /** 設定時、batch番目の生成にはこのプールのseed/upscaleSeedを使う(ランダム生成しない) */
  seedPool?: ReleasedSeed[];
  /** seedPoolの引き継ぎ元フォルダ名(UI表示用) */
  seedSourceFolder?: string;
  status: "pending" | "running" | "completed" | "cancelled" | "failed";
  currentBatch: number;
  completedImages: GalleryImage[];
  variationTags: string[];
  additionalPromptMode: "all" | "random";
  additionalPromptLines: string[];
  /** fixedTags used for random-mode per-batch re-resolution */
  fixedTags: string;
  createdAt: number;
  batchPresets: QueueItemBatchPresets;
  /** `%%name%%` 変数へユーザーが与えた入力値(input モード用)。実行時にこれを土台に解決する。 */
  variableInputValues?: VariableBindings;
  /** 実行時に参照する変数定義のスナップショット(random 候補・fixed 値・input デフォルト)。 */
  variableDefs?: VariableDefs;
  /** 解決後プロンプトへ適用する素朴な文字列置換(引き継ぎ時のエスケープハッチ)。 */
  promptReplacements?: PromptReplacement[];
  /** 指定時は img2img(この画像を初期latentに使い、denoise はこの値)。 */
  imageRef?: ImageRef;
  /** 指定時は img2img。生成バッチごとにこのプールからランダムで1枚を下絵にする(imageRef より優先)。 */
  imageRefPool?: ImageRefPool;
  /** When true, uses PCLazyTextEncode workflow for COUPLE prompt syntax */
  coupleWorkflow?: boolean;
  /** When true, uses RegionalConditioningColorMask //Inspire + ControlNet workflow */
  colorMaskWorkflow?: boolean;
  /** ControlNet config used when colorMaskWorkflow is true */
  colorMaskControlNet?: import("./couple").CoupleControlNet;
  /** Region info (colorHex + prompt + lora) used when colorMaskWorkflow is true */
  colorMaskRegions?: import("./couple").CoupleRegion[];
  /** Custom file name prefix (e.g. batch preset name). Replaces "out" in the output path. */
  filePrefix?: string;
}

export interface SizePreset {
  label: string;
  width: number;
  height: number;
}

/** img2img の下絵。指定時は EmptyLatentImage の代わりにこの画像を VAEEncode して初期latentに使う。 */
export interface ImageRef {
  /** ComfyUI input フォルダ内のファイル名(/api/comfy/upload の戻り値 name) */
  name: string;
  /** 参照 denoise。小さいほど元画像に忠実(構図・色が残る)。 */
  denoise: number;
  /** UI表示用ラベル(元ファイル名・出力相対パス等) */
  sourceLabel?: string;
}

/** 1生成でのランダム抽選1件の記録(ランダム要素ウィンドウ・メタデータ用)。 */
export interface RandomChoice {
  /** 抽選元の表示名(例 "その他: 衣装A" / "追加プロンプト" / "ランダム構図" / "%%pose%%") */
  source: string;
  /** 実際に採用された行/値 */
  picked: string;
  /** 全候補 */
  options: string[];
}

/** 構図プール。`.i2i/<group>/` の画像群から、生成ごとにランダムで1枚を下絵に使う。 */
export interface ImageRefPool {
  /** .i2i 以下のグループパス(表示・再ステージ用) */
  group: string;
  denoise: number;
  /** ステージ済みの ComfyUI input ファイル名。生成ごとにここからランダムで1枚選ぶ。 */
  names: string[];
}

export interface BatchPreset {
  id: string;
  name: string;
  /** プリセットIDで参照（実行時に最新内容を解決） */
  countPresetId: string | null;
  posePresetId: string | null;
  otherPresetIds: string[];
  additionalPrompt: string;
  additionalPromptMode: "all" | "random";
  /** 固定タグ (プリセット保存) */
  fixedTags: string;
  /** ネガティブプロンプト (プリセット保存) */
  negativePrompt: string;
  variationEnabled: boolean;
  variationTags: string[];
  batchCount: number;
  /** `%%name%%` 変数のセット単位の既定値(input モード用)。実行画面での入力が一時的に上書きする。 */
  variableValues?: VariableBindings;
  /** このプリセット固有の下絵(単一画像)。セット編集画面で指定する。 */
  imageRef?: ImageRef;
  /** このプリセット固有の構図プール(生成ごとにランダムで1枚)。セット編集画面で指定する。imageRef より優先。 */
  imageRefPool?: ImageRefPool;
}

/** 一括キュー実行時に手動指定するオーバーライド設定 */
export interface BatchRunOverrides {
  variableLora: LoraEntry | null;
  physicalPresets: Preset[];
  scenePreset: Preset | null;
  settings: GenerationSettings;
  /** ギャラリーの販売用選択画像から引き継ぐseedのプール(RunSetupViewのみ対応) */
  seedPool?: ReleasedSeed[];
  /** seedPoolの引き継ぎ元フォルダ名(UI表示用) */
  seedSourceFolder?: string;
  /** 変数入力ステップでユーザーが確定した `%%name%%` の値(全プリセット共通)。 */
  variableValues?: VariableBindings;
  /** 解決後プロンプトへ適用する文字列置換(変数化していない箇所の書き換え)。 */
  promptReplacements?: PromptReplacement[];
  /** 今回の実行で下絵(imageRef / imageRefPool)を使うプリセットIDの一覧。
   * 未指定 or 含まれないプリセットは、下絵設定があっても txt2img で生成する(既定オフ)。 */
  i2iEnabledPresetIds?: string[];
  /** 過去の良品率(release率)から生成枚数を自動的に切り詰めるか(#58)。
   * 既定オフ。オンのときのみ /api/gallery/preset-stats を取得する。 */
  applyReleaseRateAdjustment?: boolean;
}

/** 販売用選択画像から引き継ぐ、1枚分のseed情報 */
export interface ReleasedSeed {
  /** アーカイブID(/api/gallery/seed-archive/thumbnail?id=で参照するサムネの識別子) */
  id: string;
  filename: string;
  seed: number;
  upscaleSeed: number | null;
  /** この画像の生成時に確定していた `%%name%%` の解決値(引き継ぎ時の初期値)。 */
  bindings?: VariableBindings;
}

export interface BatchPresetSet {
  id: string;
  name: string;
  presets: BatchPreset[];
}

export interface GalleryImage {
  /** Unique identifier for this image (UUID assigned at generation time) */
  id?: string;
  /** Path relative to COMFYUI_OUTPUT_DIR, e.g. "20240101-loraname/out_00001_.png" */
  path: string;
  loraName: string;
  positivePrompt: string;
  negativePrompt?: string;
  settings?: GenerationSettings;
  loras?: LoraEntry[];
  queueLabel: string;
  createdAt: number;
  /** The actual additional prompt applied to this image (recorded for random mode) */
  appliedAdditional?: string;
  /** BatchPreset.id this image was generated from (一括キュー実行時のみ) */
  batchPresetId?: string;
  /** この画像の生成時に確定した `%%name%%` 変数の解決値(引き継ぎ再現用)。 */
  bindings?: VariableBindings;
  /** この画像の生成で行われたランダム抽選の記録。 */
  randomChoices?: RandomChoice[];
}
