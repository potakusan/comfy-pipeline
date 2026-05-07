"""
Resize images while preserving aspect ratio and metadata.
Usage:
  python resize.py <input_dir> -o <output_dir> -s 50 -q 85
"""
from __future__ import annotations

import argparse
import struct
import time
from pathlib import Path

from PIL import Image, PngImagePlugin
import pillow_avif  # noqa: F401  (registers AVIF support)


def check_lossless_webp(filepath: str) -> bool:
    with open(filepath, "rb") as f:
        header = f.read(12)
        riff, _, webp = struct.unpack("<4sI4s", header)
        if riff != b"RIFF" or webp != b"WEBP":
            return False
        data_length = struct.unpack("<I", header[4:8])[0] - 4
        while data_length > 0:
            chunk_header = f.read(8)
            if len(chunk_header) < 8:
                break
            fourcc, chunk_size = struct.unpack("<4sI", chunk_header)
            f.seek(chunk_size, 1)
            data_length -= chunk_size + 8
            if fourcc == b"VP8L":
                return True
            if fourcc == b"VP8 ":
                return False
    return False


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp"}


def resize_image(src: Path, dst: Path, scale: float, quality: int) -> None:
    img = Image.open(src)
    orig_format = (img.format or "PNG").lower()

    new_w = max(1, int(img.width * scale))
    new_h = max(1, int(img.height * scale))
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    dst.parent.mkdir(parents=True, exist_ok=True)

    save_params: dict = {"fp": str(dst)}

    if orig_format in ("jpeg", "jpg"):
        save_params["quality"] = quality
        exif = img.info.get("exif")
        if exif:
            save_params["exif"] = exif
    elif orig_format == "webp":
        lossless = check_lossless_webp(str(src))
        save_params["lossless"] = lossless
        if not lossless:
            save_params["quality"] = quality
        exif = img.info.get("exif")
        if exif:
            save_params["exif"] = exif
    elif orig_format == "avif":
        save_params["quality"] = quality
        exif = img.info.get("exif")
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

    files = [
        f for f in sorted(input_dir.rglob("*"))
        if f.is_file() and f.suffix.lower() in IMAGE_EXTS
    ]

    if not files:
        print("[ERROR] 処理対象の画像が見つかりませんでした")
        return

    print(f"対象ファイル数: {len(files)}")

    for f in files:
        rel = f.relative_to(input_dir)
        dst = output_dir / rel
        print(f"\nファイル {f} を処理します")
        try:
            resize_image(f, dst, scale, quality)
        except Exception as e:
            print(f"[WARN] {f} の処理に失敗しました: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="画像リサイズツール")
    parser.add_argument("input_dir", help="入力フォルダ")
    parser.add_argument("-o", "--output_dir", default="output", help="出力フォルダ")
    parser.add_argument("-s", "--scale", type=float, default=50.0,
                        help="リサイズ率（%%）例: 50 = 50%%")
    parser.add_argument("-q", "--quality", type=int, default=85,
                        help="JPEG/WebP/AVIFの品質 (1-100)")

    start = time.time()
    main(parser.parse_args())
    print(f"\n処理時間: {time.time() - start:.1f}秒")
