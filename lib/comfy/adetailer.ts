import type { GenerationSettings } from "./comfy-types";

export type NodeRef = [string, number];

/** 検出→再描画する対象1件(顔・手など)。ComfyUI の Impact Pack `FaceDetailer` 1ノードに対応する。 */
export interface AdetailerTarget {
  id: string;
  /** UI表示名(顔 / 手 など) */
  label: string;
  enabled: boolean;
  /** UltralyticsDetectorProvider の model_name (例 "bbox/face_yolov8m.pt") */
  model: string;
  /** 検出領域の再描画専用プロンプト。空なら本体のポジティブプロンプトを使う */
  prompt: string;
  denoise: number;
  steps: number;
  /** 検出の信頼度しきい値 */
  bboxThreshold: number;
  /** 検出領域の拡張(px) */
  dilation: number;
  /** 検出領域の切り出し倍率 */
  cropFactor: number;
  /** 切り出した領域を再描画するときの目標サイズ */
  guideSize: number;
  maxSize: number;
  feather: number;
}

export type AdetailerTargetKind = "face" | "hand";

const TARGET_DEFAULTS: Record<AdetailerTargetKind, Omit<AdetailerTarget, "id">> = {
  face: {
    label: "顔",
    enabled: true,
    model: "bbox/face_yolov8m.pt",
    prompt: "",
    denoise: 0.4,
    steps: 20,
    bboxThreshold: 0.5,
    dilation: 10,
    cropFactor: 3,
    guideSize: 512,
    maxSize: 1024,
    feather: 5,
  },
  hand: {
    label: "手",
    enabled: true,
    model: "bbox/hand_yolov8s.pt",
    prompt: "",
    denoise: 0.45,
    steps: 20,
    bboxThreshold: 0.5,
    dilation: 10,
    cropFactor: 3,
    guideSize: 512,
    maxSize: 1024,
    feather: 5,
  },
};

export function newAdetailerTarget(kind: AdetailerTargetKind): AdetailerTarget {
  return { id: crypto.randomUUID(), ...TARGET_DEFAULTS[kind] };
}

/** 実際にワークフローへ入れる対象(有効で、検出モデルが指定されているもの)。 */
export function activeAdetailerTargets(targets: AdetailerTarget[] | undefined): AdetailerTarget[] {
  return (targets ?? []).filter((t) => t.enabled && t.model.trim());
}

/**
 * `image` に対して有効な対象を順に FaceDetailer へ通すチェーンを組み、最終画像の参照を返す。
 * 対象が無ければ `image` をそのまま返す。seed は本体の seed を使い、再現性を保つ。
 * 再描画専用プロンプトが空の対象は本体の positive をそのまま使う。
 */
export function appendAdetailerChain(
  wf: Record<string, unknown>,
  args: {
    image: NodeRef;
    targets: AdetailerTarget[] | undefined;
    settings: GenerationSettings;
    seed: number;
    model: NodeRef;
    clip: NodeRef;
    vae: NodeRef;
    positive: NodeRef;
    negative: NodeRef;
  },
): NodeRef {
  let image = args.image;
  activeAdetailerTargets(args.targets).forEach((t, i) => {
    const detId = `adet${i}_det`;
    const posId = `adet${i}_pos`;
    const id = `adet${i}`;

    wf[detId] = {
      inputs: { model_name: t.model },
      class_type: "UltralyticsDetectorProvider",
    };

    let positive = args.positive;
    if (t.prompt.trim()) {
      wf[posId] = {
        inputs: { text: t.prompt, clip: args.clip },
        class_type: "CLIPTextEncode",
      };
      positive = [posId, 0];
    }

    // Impact Pack のバージョンで必須入力が異なるため、新旧どちらでも通るよう全入力を渡す
    // (ComfyUI は未知の入力を無視する)。
    wf[id] = {
      inputs: {
        image,
        model: args.model,
        clip: args.clip,
        vae: args.vae,
        guide_size: t.guideSize,
        guide_size_for: true,
        max_size: t.maxSize,
        seed: args.seed,
        steps: t.steps,
        cfg: args.settings.cfg,
        sampler_name: args.settings.sampler,
        scheduler: args.settings.scheduler,
        positive,
        negative: args.negative,
        denoise: t.denoise,
        feather: t.feather,
        noise_mask: true,
        force_inpaint: true,
        bbox_threshold: t.bboxThreshold,
        bbox_dilation: t.dilation,
        bbox_crop_factor: t.cropFactor,
        sam_detection_hint: "center-1",
        sam_dilation: 0,
        sam_threshold: 0.93,
        sam_bbox_expansion: 0,
        sam_mask_hint_threshold: 0.7,
        sam_mask_hint_use_negative: "False",
        drop_size: 10,
        bbox_detector: [detId, 0],
        wildcard: "",
        cycle: 1,
        inpaint_model: false,
        noise_mask_feather: 20,
        tiled_encode: false,
        tiled_decode: false,
      },
      class_type: "FaceDetailer",
    };
    image = [id, 0];
  });
  return image;
}
