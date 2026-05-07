from __future__ import annotations

from pathlib import Path
import os
import argparse
import time
from typing import TYPE_CHECKING, Generic, Optional, TypeVar
from dataclasses import dataclass, field

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, PngImagePlugin
import pillow_avif
import struct
from torchvision.transforms.functional import to_pil_image

if TYPE_CHECKING:
    import torch
    from ultralytics import YOLO, YOLOWorld


T = TypeVar('T')

@dataclass
class PredictOutput(Generic[T]):
    bboxes: list[list[T]] = field(default_factory=list)
    masks: list[Image.Image] = field(default_factory=list)
    preview: Optional[Image.Image] = None

# 生成メタ情報を持ったままモザイクをかける
def apply_mosaic_with_meta(image_path: str, output_path: str, bboxes: list[list[float]], combined_masks: list[Image.Image], mosaic_size: int = 10, no_meta: bool = False, use_masks: bool = False, expand: float = 0.0):

    t_process_start = time.perf_counter()
    
    pil_image = Image.open(image_path)
    img_w, img_h = pil_image.size

    # bboxes が空の場合はこのループ全体がスキップされる
    for (bbox, mask) in zip(bboxes, combined_masks):
        x1, y1, x2, y2 = map(int, bbox)

        expand_px = 0
        if expand > 0:
            dx = int((x2 - x1) * expand)
            dy = int((y2 - y1) * expand)
            expand_px = max(dx, dy)
            x1 = max(0, x1 - dx)
            y1 = max(0, y1 - dy)
            x2 = min(img_w, x2 + dx)
            y2 = min(img_h, y2 + dy)

        w, h = x2 - x1, y2 - y1
        if w <= 0 or h <= 0: continue

        # ROIのみ切り出し（高速化）
        roi = pil_image.crop((x1, y1, x2, y2))

        # モザイク処理
        shrink_w, shrink_h = max(1, w // mosaic_size), max(1, h // mosaic_size)
        roi_mosaic = roi.resize((shrink_w, shrink_h), Image.Resampling.BOX)
        roi_mosaic = roi_mosaic.resize((w, h), Image.Resampling.NEAREST)

        if use_masks:
            pil_image.paste(roi_mosaic, (x1, y1, x2, y2))
        else:
            mask_roi = mask.crop((x1, y1, x2, y2))
            if expand_px > 0:
                mask_roi = mask_roi.filter(ImageFilter.MaxFilter(expand_px * 2 + 1))
            pil_image.paste(roi_mosaic, (x1, y1, x2, y2), mask_roi)
            
    t_process_end = time.perf_counter()

    # 保存パラメータ準備
    image_format = pil_image.format.lower() if pil_image.format else 'unknown'
    save_params = {'fp':output_path}
    if not no_meta:
        if (image_format in ["jpeg", "webp", "avif"]):
            exifdata = pil_image.info.get("exif")
            if exifdata:
                save_params['exif'] = exifdata
            if (image_format == "webp"):
                save_params['lossless'] = check_lossless_webp(image_path)
        else:
            metadata = PngImagePlugin.PngInfo()
            for k, v in pil_image.info.items():
                metadata.add_itxt(k, str(v))
            save_params['pnginfo'] = metadata

    t_save_start = time.perf_counter()
    pil_image.save(**save_params)
    t_save_end = time.perf_counter()

    # ログ出力（加工プロセスがあった場合のみ時間を出すと見やすい）
    if bboxes:
        print(f"  - [加工] {t_process_end - t_process_start:.3f}秒")
    print(f"  - [保存] {t_save_end - t_save_start:.3f}秒")
    print(f"画像を保存しました: {output_path}")

def ultralytics_predict(
    model_path: str | Path,
    image: Image.Image,
    confidence: float = 0.3,
    retina_masks: bool = False,
    device: str = "",
    classes: str = "",
) -> PredictOutput[float]:
    import torch
    from ultralytics import YOLO

    model = YOLO(model_path)
    apply_classes(model, model_path, classes)
    pred = model(image, conf=confidence, device=device, retina_masks=retina_masks)

    bboxes_np = pred[0].boxes.xyxy.cpu().numpy()
    if bboxes_np.size == 0:
        return PredictOutput()

    if classes and "-world" not in Path(model_path).stem:
        wanted = {c.strip().lower() for c in classes.split(",") if c.strip()}
        model_names = {k: v.lower() for k, v in model.names.items()}
        cls_indices = pred[0].boxes.cls.cpu().numpy().astype(int)
        keep = [i for i, ci in enumerate(cls_indices) if model_names.get(ci, "") in wanted]
        if not keep:
            return PredictOutput()
        bboxes_np = bboxes_np[keep]
        raw_masks = pred[0].masks
        if raw_masks is None:
            masks = create_mask_from_bbox(bboxes_np.tolist(), image.size)
        else:
            keep_t = torch.tensor(keep, dtype=torch.long, device=raw_masks.data.device)
            masks = mask_to_pil(raw_masks.data[keep_t], image.size)
    else:
        if pred[0].masks is None:
            masks = create_mask_from_bbox(bboxes_np.tolist(), image.size)
        else:
            masks = mask_to_pil(pred[0].masks.data, image.size)

    preview = pred[0].plot()
    preview = cv2.cvtColor(preview, cv2.COLOR_BGR2RGB)
    preview = Image.fromarray(preview)

    return PredictOutput(bboxes=bboxes_np.tolist(), masks=masks, preview=preview)

def create_mask_from_bbox(
    bboxes: list[list[float]], shape: tuple[int, int]
) -> list[Image.Image]:
    masks = []
    for bbox in bboxes:
        mask = Image.new("L", shape, 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rectangle(bbox, fill=255)
        masks.append(mask)
    return masks

def apply_classes(model: YOLO | YOLOWorld, model_path: str | Path, classes: str):
    if not classes or "-world" not in Path(model_path).stem:
        return
    parsed = [c.strip() for c in classes.split(",") if c.strip()]
    if parsed:
        model.set_classes(parsed)

def mask_to_pil(masks: torch.Tensor, shape: tuple[int, int]) -> list[Image.Image]:
    n = masks.shape[0]
    img_w, img_h = shape
    mask_h, mask_w = masks[0].shape
    aspect_w = img_w/mask_w
    aspect_h = img_h/mask_h
    if aspect_w > aspect_h:
        crop_y = int((img_h*aspect_w//aspect_h - img_h)//2)
        pil_masks = [to_pil_image(masks[i], mode="L").resize((img_w, int(mask_h*aspect_w))).crop((0, crop_y, img_w, crop_y + img_h)) for i in range(n)]
    else:
        crop_x = int((img_w*aspect_h//aspect_w - img_w)//2)
        pil_masks = [to_pil_image(masks[i], mode="L").resize((int(mask_w*aspect_h), img_h)).crop((crop_x, 0, crop_x + img_w, img_h)) for i in range(n)]

    return pil_masks

def check_models(model_name_list: list[str]) -> list[str]:
    valid_models = []
    if model_name_list == None or len(model_name_list) <= 0:
        print("検出用モデルが指定されていません")
        return valid_models

    model_dir = Path(".\\models")
    for name in model_name_list:
        model = model_dir.joinpath(name.strip())
        if model.is_file():
            valid_models.append(str(model))
        else:
            print(f"[WARN]モデル {model} は見つかりませんでした")

    return valid_models

def get_target_files(target_files_dir: list[str]) -> list[str]:
    image_extensions = [".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp", ".avif"]
    valid_imgfiles = []

    for file_or_dir in target_files_dir:
        p_file_or_dir = Path(file_or_dir)
        if p_file_or_dir.is_file() and p_file_or_dir.suffix.lower() in image_extensions:
            valid_imgfiles.append(file_or_dir)
        elif p_file_or_dir.is_dir():
            valid_imgfiles += [str(f) for f in list(p_file_or_dir.glob("**/*.*")) if f.suffix.lower() in image_extensions]

    return valid_imgfiles

def get_org_filename(p_file_path: Path) -> str:
    if p_file_path.exists():
        parent = p_file_path.parent
        for i in range(1,1000):
            new_path = parent.joinpath(f"{p_file_path.stem}{i}{p_file_path.suffix}")
            if not new_path.exists():
                return str(new_path)
    else:
        return str(p_file_path)

    raise ValueError(f"{p_file_path}のユニーク名の生成に失敗しました")

def get_output_filename(output_dir: Path, file_path: str, add_txt: str = "") -> str:
    p_file_path = Path(file_path)
    p_output_file_path = output_dir.joinpath(f"{p_file_path.stem}_{add_txt}{p_file_path.suffix}")
    return get_org_filename(p_output_file_path)

def check_lossless_webp(filepath: str) -> bool:
    with open(filepath, 'br') as f:
        header = f.read(12)
        riff, data_lenth, webp = struct.unpack('<4sI4s', header)
        if (riff != b'RIFF' or webp != b'WEBP'):
            return False
        data_lenth -= len(webp)

        while data_lenth > 0:
            header = f.read(8)
            chunk_fourCC, chunk_size = struct.unpack('<4sI', header)
            f.seek(chunk_size, 1)
            data_lenth -= chunk_size + len(header)
            if chunk_fourCC == b'VP8L':
                return True
            if chunk_fourCC == b'VP8 ':
                return False
    return False

def main(args):
    # 入力の検証
    models = check_models(args.models)
    if len(models) <= 0:
        print("[ERROR]検出用モデルが見つかりませんでした")
        return

    targets = get_target_files(args.target_files_dir)
    if len(targets) <= 0:
        print("[ERROR]処理対象の画像ファイルが見つかりませんでした")
        return

    output_dir_name = args.output_dir.strip()
    mosaic_size = max(1, args.mosaic_size)
    confidence = max(0.01, min(1.0, args.confidence))
    device = args.device
    save_preview = args.save_preview
    save_masks = args.save_masks
    use_masks = args.use_masks
    no_meta = args.no_meta
    save_same_dir = args.save_same_dir

    if not save_same_dir:
        output_dir = Path(output_dir_name)
        output_dir.mkdir(parents=True, exist_ok=True)

    for image_file in targets:
        print(f"\nファイル {image_file} を処理します")
        if save_same_dir:
            output_dir = Path(image_file).parent

        image = Image.open(image_file).convert("RGB")

        # --- 物体検出 ---
        t_detect_start = time.perf_counter()
        result_list = [ultralytics_predict(m, image, confidence=confidence, retina_masks=args.retina_masks, device=device, classes=args.classes) for m in models]
        t_detect_end = time.perf_counter()
        
        print(f"  - [検出] {t_detect_end - t_detect_start:.3f}秒 (モデル数: {len(models)})")

        combined_bboxes = []
        combined_masks  = []
        for result in result_list:
            combined_bboxes += result.bboxes
            combined_masks  += result.masks
                
            if save_preview and result.preview:
                result.preview.save(get_output_filename(output_dir, image_file, "preview"))
            if save_masks and result.masks:
                for mask in result.masks:
                    mask.save(get_output_filename(output_dir, image_file, "mask"))

        # 検出の有無に関わらず apply_mosaic_with_meta を呼ぶ
        if not combined_bboxes:
            print("  - 検出対象なし：そのまま保存します")
            
        output_mosaic_path = get_output_filename(output_dir, image_file, "mosaic")
        apply_mosaic_with_meta(
            image_file, 
            output_mosaic_path, 
            combined_bboxes, 
            combined_masks, 
            mosaic_size, 
            no_meta=no_meta, 
            use_masks=use_masks, 
            expand=args.expand
        )


tp = lambda x:list(map(str, x.split(',')))
parser = argparse.ArgumentParser(description="センシティブな部位を自動で検出しモザイクをかけるプログラムです。")
parser.add_argument("target_files_dir", nargs="*", default=[".\\input"], help="処理対象のファイルやフォルダ")
parser.add_argument("-o", "--output_dir", default="output", help="出力先のフォルダ")
parser.add_argument("-m", "--models", type=tp, default="pussyV2.pt,penis.pt", help="検出用モデル（,区切りで複数指定可）")
parser.add_argument("-n", "--no-meta", action="store_true", help="メタデータをコピーしない")
parser.add_argument("-sp", "--save-preview", action="store_true", help="プレビュー画像を保存する")
parser.add_argument("-sm", "--save-masks", action="store_true", help="マスク画像を保存する")
parser.add_argument("-ssd", "--save-same-dir", action="store_true", help="入力画像ファイルと同じ場所に出力する")
parser.add_argument("-s", "--mosaic-size", type=int, default=10, help="モザイクのサイズ")
parser.add_argument("-um", "--use-masks", action="store_false", help="マスク画像を使用する")
parser.add_argument("-rm", "--retina_masks", action="store_true", help="高解像度セグメンテーションマスクを使用する")
parser.add_argument("-c", "--confidence", type=float, default=0.25, help="信頼度スコアのしきい値(0.01-1.00)")
parser.add_argument("-d", "--device", default="", help="処理デバイス(CPUで処理したい場合：--device cpu)")
parser.add_argument("--classes", type=str, default="", help="検出クラスフィルタ（カンマ区切り）: nipples,pussy,penis 等。空欄=全クラス")
parser.add_argument("-e", "--expand", type=float, default=0.0, help="検知範囲を bbox サイズの何倍拡張するか（0.0=拡張なし、0.2=20%%拡張）")

if __name__ == "__main__":
    start = time.time()
    main(parser.parse_args())
    end = time.time()
    print(f"\n全工程の処理時間:{end - start:.1f}秒")