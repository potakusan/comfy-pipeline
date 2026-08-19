import { describe, expect, it } from "vitest";
import { computeAutoMosaicSize, mimeFromExt } from "@/lib/mosaic-canvas";

describe("computeAutoMosaicSize", () => {
  it("returns 4px fixed for images under 400px long side", () => {
    expect(computeAutoMosaicSize(399)).toBe(4);
    expect(computeAutoMosaicSize(100)).toBe(4);
  });

  it("returns long side / 100 (rounded) for images >= 400px", () => {
    expect(computeAutoMosaicSize(1000)).toBe(10);
    expect(computeAutoMosaicSize(832)).toBe(8);
    expect(computeAutoMosaicSize(1216)).toBe(12);
  });

  it("never returns less than 4px even when long side / 100 rounds below it", () => {
    expect(computeAutoMosaicSize(400)).toBe(4);
    expect(computeAutoMosaicSize(449)).toBe(4);
  });
});

describe("mimeFromExt", () => {
  it("maps common photo extensions to their mime type", () => {
    expect(mimeFromExt("out.png")).toBe("image/png");
    expect(mimeFromExt("out.jpg")).toBe("image/jpeg");
    expect(mimeFromExt("out.jpeg")).toBe("image/jpeg");
    expect(mimeFromExt("out.webp")).toBe("image/webp");
  });

  it("returns null for extensions canvas.toBlob can't natively re-encode (gif/avif/unknown)", () => {
    expect(mimeFromExt("out.gif")).toBeNull();
    expect(mimeFromExt("out.avif")).toBeNull();
    expect(mimeFromExt("out")).toBeNull();
  });
});
