import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readArchivedThumbnail } from "@/lib/server/gallery-seed-archive";

describe("readArchivedThumbnail", () => {
  it("rejects ids containing path traversal or path separators without touching the filesystem", () => {
    expect(readArchivedThumbnail("../../../etc/passwd")).toBeNull();
    expect(readArchivedThumbnail("..")).toBeNull();
    expect(readArchivedThumbnail("a/b")).toBeNull();
    expect(readArchivedThumbnail("a\\b")).toBeNull();
  });

  it("returns null for a well-formed id that simply doesn't exist yet", () => {
    expect(readArchivedThumbnail("does-not-exist_ABC123")).toBeNull();
  });
});

describe("saved presets storage", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cp-saved-"));

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/server/output-dir", async () => {
      const actual = await vi.importActual<typeof import("@/lib/server/output-dir")>(
        "@/lib/server/output-dir",
      );
      return { ...actual, getOutputDir: () => tmp };
    });
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
  });
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const metadata = {
    mode: "normal",
    loraName: "x",
    positivePrompt: "p",
    settings: { seed: 42, upscaleSeed: 7 },
    queueLabel: "q",
    createdAt: 1,
    batchPresetId: "bp1",
    recipe: { schemaVersion: 1 },
  } as unknown as import("@/lib/gallery").ImageMetadata;

  async function makePng(file: string) {
    await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#f00" } })
      .png()
      .toFile(file);
  }

  it("writes a shrunk jpg plus json (with recipe) and removes both on deselect", async () => {
    const mod = await import("@/lib/server/gallery-seed-archive");
    fs.mkdirSync(path.join(tmp, "f1"));
    await makePng(path.join(tmp, "f1", "a.png"));

    await mod.archiveSeed({
      folder: "f1",
      filename: "a.png",
      imagePath: path.join(tmp, "f1", "a.png"),
      metadata,
    });

    const jpg = path.join(tmp, "_savedpresets", "f1", "a.png.jpg");
    const meta = await sharp(jpg).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBe(768);

    const entries = await mod.listArchivedSeeds();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ seed: 42, upscaleSeed: 7, batchPresetId: "bp1" });
    expect(entries[0].metadata?.recipe).toEqual({ schemaVersion: 1 });
    expect(mod.readArchivedThumbnail(entries[0].id)).not.toBeNull();

    mod.removeArchivedSeed("f1", "a.png");
    expect(await mod.listArchivedSeeds()).toHaveLength(0);
    expect(fs.existsSync(jpg)).toBe(false);
  });

  it("migrates legacy .seed-archive entries into _savedpresets", async () => {
    const mod = await import("@/lib/server/gallery-seed-archive");
    const id = Buffer.from("old/b.png", "utf-8").toString("base64url");
    const legacy = path.join(tmp, ".seed-archive");
    fs.mkdirSync(legacy);
    fs.writeFileSync(
      path.join(legacy, `${id}.json`),
      JSON.stringify({
        id,
        sourceFolder: "old",
        sourceFilename: "b.png",
        seed: 1,
        upscaleSeed: null,
        archivedAt: 5,
      }),
    );
    await sharp({ create: { width: 100, height: 50, channels: 3, background: "#0f0" } })
      .webp()
      .toFile(path.join(legacy, `${id}.webp`));

    const entries = await mod.listArchivedSeeds();
    expect(entries.map((e) => e.id)).toEqual([id]);
    expect(mod.readArchivedThumbnail(id)).not.toBeNull();
    expect(fs.existsSync(legacy)).toBe(false);
  });
});
