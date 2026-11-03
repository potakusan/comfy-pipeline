import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { convertedFilename, convertOutputImage, needsConversion } from "@/lib/server/output-convert";
import { normalizeOutputImageSettings, type OutputImageSettings } from "@/lib/setup/output-format";

const base: OutputImageSettings = { format: "jpg", quality: 95, lossless: false, chroma444: true };

describe("output-convert", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-convert-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  async function makePng(name: string) {
    const p = path.join(dir, name);
    await sharp({ create: { width: 64, height: 96, channels: 3, background: { r: 200, g: 40, b: 40 } } })
      .png()
      .toFile(p);
    return p;
  }

  it("拡張子だけを差し替え、連番サフィックスは維持する", () => {
    expect(convertedFilename("a_00001_.png", "jpg")).toBe("a_00001_.jpg");
    expect(convertedFilename("a b.v2.png", "webp")).toBe("a b.v2.webp");
    expect(convertedFilename("a_00001_.png", "png")).toBe("a_00001_.png");
  });

  it("PNGで、かつ形式がpng以外のときだけ変換対象", () => {
    expect(needsConversion("a.png", "jpg")).toBe(true);
    expect(needsConversion("a.PNG", "webp")).toBe(true);
    expect(needsConversion("a.png", "png")).toBe(false);
    expect(needsConversion("a.jpg", "jpg")).toBe(false);
  });

  it("未設定・不正値は JPG 品質95・4:4:4 にする", () => {
    expect(normalizeOutputImageSettings({})).toEqual(base);
    expect(normalizeOutputImageSettings({ format: "gif", quality: 0 })).toEqual(base);
    expect(normalizeOutputImageSettings({ format: "webp", quality: 80.4, lossless: true })).toMatchObject({
      format: "webp",
      quality: 80,
      lossless: true,
    });
  });

  it("JPGへ変換して元のPNGを消す", async () => {
    const src = await makePng("a_00001_.png");
    const dest = await convertOutputImage(src, base);
    expect(path.basename(dest)).toBe("a_00001_.jpg");
    expect(fs.existsSync(src)).toBe(false);
    const meta = await sharp(fs.readFileSync(dest)).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([64, 96]);
    expect(fs.readdirSync(dir)).toEqual(["a_00001_.jpg"]);
  });

  it("WebP(ロスレス/非ロスレス)へ変換できる", async () => {
    const a = await convertOutputImage(await makePng("a.png"), { ...base, format: "webp", lossless: true });
    const b = await convertOutputImage(await makePng("b.png"), { ...base, format: "webp", quality: 90 });
    expect((await sharp(fs.readFileSync(a)).metadata()).format).toBe("webp");
    expect((await sharp(fs.readFileSync(b)).metadata()).format).toBe("webp");
  });

  it("変換に失敗したら元のPNGを残す", async () => {
    const bad = path.join(dir, "broken.png");
    fs.writeFileSync(bad, "not an image");
    await expect(convertOutputImage(bad, base)).rejects.toThrow();
    expect(fs.existsSync(bad)).toBe(true);
    expect(fs.readdirSync(dir)).toEqual(["broken.png"]);
  });
});
