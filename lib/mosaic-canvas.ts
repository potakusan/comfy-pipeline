/** automosaic.py の自動サイズ式と同じ（長辺÷100、最小4px、長辺400px未満は4px固定）。
 *  手動編集エディタの初期モザイクサイズを一括AI処理のデフォルトと揃えるために使う。 */
export function computeAutoMosaicSize(longSide: number): number {
  if (longSide < 400) return 4;
  return Math.max(4, Math.round(longSide / 100));
}

function averageBlockColor(
  data: Uint8ClampedArray,
  regionW: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): [number, number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let count = 0;
  for (let yy = 0; yy < bh; yy++) {
    for (let xx = 0; xx < bw; xx++) {
      const i = ((by + yy) * regionW + (bx + xx)) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      a += data[i + 3];
      count++;
    }
  }
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count), Math.round(a / count)];
}

function fillBlock(
  data: Uint8ClampedArray,
  regionW: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  [r, g, b, a]: readonly [number, number, number, number],
): void {
  for (let yy = 0; yy < bh; yy++) {
    for (let xx = 0; xx < bw; xx++) {
      const i = ((by + yy) * regionW + (bx + xx)) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
}

/**
 * なぞって囲んだ閉じたパスの内側だけをブロック平均モザイクで塗りつぶす（投げ縄選択と同じ操作感）。
 * ブロック境界は画像座標(0,0)基準の絶対グリッドにスナップするため、重ねて囲んでも継ぎ目がずれない。
 *
 * ブロック単位で「中心点が内側か」を判定する方式だと、境界をまたぐブロックが丸ごと
 * 採用/棄却されるため、はみ出しと隙間が同時に発生する。そこで一旦バウンディングボックス
 * 全体を隙間なくフルにモザイク化した作業用canvasを作り、なぞったパス自体をマスクとして
 * destination-in合成することでパスの形状にピクセル単位（アンチエイリアス込み）で
 * クリップする。
 */
export function applyMosaicToPath(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  blockSize: number,
): void {
  if (points.length < 3) return;
  const { width, height } = ctx.canvas;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const x0 = Math.max(0, Math.floor(minX / blockSize) * blockSize);
  const y0 = Math.max(0, Math.floor(minY / blockSize) * blockSize);
  const x1 = Math.min(width, Math.ceil(maxX / blockSize) * blockSize);
  const y1 = Math.min(height, Math.ceil(maxY / blockSize) * blockSize);
  const regionW = x1 - x0;
  const regionH = y1 - y0;
  if (regionW <= 0 || regionH <= 0) return;

  // 1. バウンディングボックス全体を隙間なくブロック平均で塗った作業用canvasを作る
  const work = document.createElement("canvas");
  work.width = regionW;
  work.height = regionH;
  const workCtx = work.getContext("2d");
  if (!workCtx) return;

  const imageData = ctx.getImageData(x0, y0, regionW, regionH);
  const data = imageData.data;
  for (let by = 0; by < regionH; by += blockSize) {
    for (let bx = 0; bx < regionW; bx += blockSize) {
      const bw = Math.min(blockSize, regionW - bx);
      const bh = Math.min(blockSize, regionH - by);
      const color = averageBlockColor(data, regionW, bx, by, bw, bh);
      fillBlock(data, regionW, bx, by, bw, bh, color);
    }
  }
  workCtx.putImageData(imageData, 0, 0);

  // 2. なぞったパス(作業用canvasのローカル座標へ平行移動)でマスクし、パス外側を透明にする
  workCtx.globalCompositeOperation = "destination-in";
  workCtx.fillStyle = "#000";
  workCtx.beginPath();
  workCtx.moveTo(points[0].x - x0, points[0].y - y0);
  for (let i = 1; i < points.length; i++) workCtx.lineTo(points[i].x - x0, points[i].y - y0);
  workCtx.closePath();
  workCtx.fill();

  // 3. マスク済みモザイクを元のcanvasへ重ねる(パス外側は透明なので元画像がそのまま残る)
  ctx.drawImage(work, x0, y0);
}

/** 保存時のcanvas.toBlobに渡すMIMEタイプを拡張子から決定する（png/jpg/jpeg/webp対応、それ以外はpng）。 */
export function mimeFromExt(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}
