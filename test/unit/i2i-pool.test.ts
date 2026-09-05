import { describe, expect, it } from "vitest";
import {
  listGroupImages,
  listI2iGroups,
  readImage,
  deleteImage,
  addImageFromBuffer,
} from "@/lib/server/i2i-pool";

describe("i2i-pool path safety", () => {
  it("listGroupImages rejects traversal / bad group names", () => {
    expect(listGroupImages("../secrets")).toEqual([]);
    expect(listGroupImages("/abs/path")).toEqual([]);
    expect(listGroupImages("a\\b")).toEqual([]);
    expect(listGroupImages("")).toEqual([]);
    expect(listGroupImages("a/../../b")).toEqual([]);
  });

  it("addImageFromBuffer rejects invalid groups", async () => {
    expect(await addImageFromBuffer("../x", Buffer.from("x"), "png")).toBeNull();
    expect(await addImageFromBuffer("", Buffer.from("x"), "png")).toBeNull();
  });

  it("readImage / deleteImage reject traversal and non-image paths", () => {
    expect(readImage("../../../etc/passwd")).toBeNull();
    expect(readImage("group/notes.txt")).toBeNull();
    expect(deleteImage("../../x.png")).toBe(false);
    expect(deleteImage("group/notes.txt")).toBe(false);
  });

  it("listI2iGroups never returns entries outside .i2i and always caps thumbnails at 4", () => {
    for (const g of listI2iGroups()) {
      expect(g.path.startsWith("/")).toBe(false);
      expect(g.path.includes("..")).toBe(false);
      expect(g.thumbnails.length).toBeLessThanOrEqual(4);
      expect(g.thumbnails.every((t) => t.startsWith(`${g.path}/`))).toBe(true);
    }
  });
});
