"""automosaic.pyとresize.pyで共有するWebPヘルパー。"""
from __future__ import annotations

import struct


def check_lossless_webp(filepath: str) -> bool:
    """filepathのWebPがロスレス(VP8L)コーデックかを判定する。

    RIFFチャンクはワード境界に揃えられており、奇数サイズのチャンクには
    1バイトのパディングが付く。これを考慮せずシークすると後続のチャンク
    ヘッダをずれた位置から読んでしまい、struct.unpackが例外を投げる。
    """
    with open(filepath, "rb") as f:
        header = f.read(12)
        if len(header) < 12:
            return False
        riff, _, webp = struct.unpack("<4sI4s", header)
        if riff != b"RIFF" or webp != b"WEBP":
            return False
        data_length = struct.unpack("<I", header[4:8])[0] - 4
        while data_length > 0:
            chunk_header = f.read(8)
            if len(chunk_header) < 8:
                break
            fourcc, chunk_size = struct.unpack("<4sI", chunk_header)
            padded_size = chunk_size + (chunk_size & 1)
            f.seek(padded_size, 1)
            data_length -= padded_size + 8
            if fourcc == b"VP8L":
                return True
            if fourcc == b"VP8 ":
                return False
    return False
