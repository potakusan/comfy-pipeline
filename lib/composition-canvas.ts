/** Stack-based 4-connected flood fill, mutating ctx in place via putImageData. */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
) {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const idx = (x: number, y: number) => (y * width + x) * 4;
  const start = idx(startX, startY);
  const targetColor: [number, number, number, number] = [
    data[start],
    data[start + 1],
    data[start + 2],
    data[start + 3],
  ];

  if (
    targetColor[0] === fillColor[0] &&
    targetColor[1] === fillColor[1] &&
    targetColor[2] === fillColor[2] &&
    targetColor[3] === fillColor[3]
  )
    return;

  const stack: [number, number][] = [[startX, startY]];
  const matches = (x: number, y: number) => {
    const i = idx(x, y);
    return (
      data[i] === targetColor[0] &&
      data[i + 1] === targetColor[1] &&
      data[i + 2] === targetColor[2] &&
      data[i + 3] === targetColor[3]
    );
  };
  const paint = (x: number, y: number) => {
    const i = idx(x, y);
    data[i] = fillColor[0];
    data[i + 1] = fillColor[1];
    data[i + 2] = fillColor[2];
    data[i + 3] = fillColor[3];
  };

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
    if (!matches(cx, cy)) continue;
    paint(cx, cy);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}

export function hexToRgba(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 255];
}
