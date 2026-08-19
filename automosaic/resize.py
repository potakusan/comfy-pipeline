"""
Resize images while preserving aspect ratio and metadata.
Usage:
  python resize.py <input_dir> -o <output_dir> -s 50 -q 85 -w 8
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, PngImagePlugin
import pillow_avif  # noqa: F401  (registers AVIF support)

from webp_utils import check_lossless_webp

# Console codepage (e.g. cp932 on Japanese Windows) can't encode arbitrary
# filename characters; force UTF-8 output so non-ASCII filenames never crash printing.
sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")

# Serialize file-existence checks + directory creation to avoid races
_fs_lock = threading.Lock()


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp"}


def resize_image(src: Path, dst: Path, scale: float, quality: int, fmt: str = "keep") -> None:
    img = Image.open(src)
    orig_format = (img.format or "PNG").lower()

    new_w = max(1, int(img.width * scale))
    new_h = max(1, int(img.height * scale))
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    if fmt == "jpg":
        dst = dst.with_suffix(".jpg")
    elif fmt == "png":
        dst = dst.with_suffix(".png")

    with _fs_lock:
        dst.parent.mkdir(parents=True, exist_ok=True)

    save_params: dict = {"fp": str(dst)}
    exif = img.info.get("exif")

    if fmt == "jpg":
        # JPEGはアルファチャンネル非対応のため、透過がある場合は白背景に合成してから変換する
        if resized.mode in ("RGBA", "LA") or "transparency" in resized.info:
            resized = resized.convert("RGBA")
            background = Image.new("RGB", resized.size, (255, 255, 255))
            background.paste(resized, mask=resized.split()[3])
            resized = background
        elif resized.mode != "RGB":
            resized = resized.convert("RGB")
        save_params["format"] = "JPEG"
        save_params["quality"] = quality
        if exif:
            save_params["exif"] = exif
    elif fmt == "png":
        save_params["format"] = "PNG"
        meta = PngImagePlugin.PngInfo()
        for k, v in img.info.items():
            if isinstance(v, str):
                meta.add_itxt(k, v)
        save_params["pnginfo"] = meta
    elif orig_format in ("jpeg", "jpg"):
        save_params["quality"] = quality
        if exif:
            save_params["exif"] = exif
    elif orig_format == "webp":
        lossless = check_lossless_webp(str(src))
        save_params["lossless"] = lossless
        if not lossless:
            save_params["quality"] = quality
        if exif:
            save_params["exif"] = exif
    elif orig_format == "avif":
        save_params["quality"] = quality
        if exif:
            save_params["exif"] = exif
    elif orig_format == "png":
        meta = PngImagePlugin.PngInfo()
        for k, v in img.info.items():
            if isinstance(v, str):
                meta.add_itxt(k, v)
        save_params["pnginfo"] = meta

    resized.save(**save_params)
    print(f"リサイズ完了: {dst} ({img.width}x{img.height} -> {new_w}x{new_h})")


def main(args: argparse.Namespace) -> None:
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    scale = max(0.01, min(1.0, args.scale / 100.0))
    quality = max(1, min(100, args.quality))
    workers = max(1, args.workers)

    files = [
        f for f in sorted(input_dir.glob("**/*"))
        if f.is_file() and f.suffix.lower() in IMAGE_EXTS
    ]

    if not files:
        print("[ERROR] 処理対象の画像が見つかりませんでした")
        return

    print(f"対象ファイル数: {len(files)}  workers: {workers}")

    if workers == 1:
        for f in files:
            dst = output_dir / f.relative_to(input_dir)
            try:
                resize_image(f, dst, scale, quality, args.format)
            except Exception as e:
                print(f"[WARN] {f} の処理に失敗しました: {e}")
    else:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(
                    resize_image,
                    f,
                    output_dir / f.relative_to(input_dir),
                    scale,
                    quality,
                    args.format,
                ): f
                for f in files
            }
            for future in as_completed(futures):
                src = futures[future]
                try:
                    future.result()
                except Exception as e:
                    print(f"[WARN] {src} の処理に失敗しました: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="画像リサイズツール")
    parser.add_argument("input_dir", help="入力フォルダ")
    parser.add_argument("-o", "--output_dir", default="output", help="出力フォルダ")
    parser.add_argument("-s", "--scale", type=float, default=50.0,
                        help="リサイズ率（%%）例: 50 = 50%%")
    parser.add_argument("-q", "--quality", type=int, default=85,
                        help="JPEG/WebP/AVIFの品質 (1-100)")
    parser.add_argument("-w", "--workers", type=int,
                        default=max(1, os.cpu_count() or 1),
                        help=f"並列スレッド数（デフォルト: CPUコア数 = {max(1, os.cpu_count() or 1)}）")
    parser.add_argument("--format", choices=["keep", "png", "jpg"], default="keep",
                        help="出力形式を強制変換する（keep=元の形式のまま、既定）")

    start = time.time()
    main(parser.parse_args())
    print(f"\n処理時間: {time.time() - start:.1f}秒")
