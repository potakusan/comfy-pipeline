import { describe, it, expect } from "vitest";
import path from "path";
import {
  buildReleaseDir,
  formatDateYmd,
  maxExistingSequence,
  numberedNames,
  sanitizeFolderName,
} from "@/lib/gallery-release-copy";

describe("gallery-release-copy", () => {
  it("YYYYMMDD形式にする", () => {
    expect(formatDateYmd(new Date(2026, 10, 2))).toBe("20261102");
  });

  it("<root>/YYYYMM/YYYYMMDD_キャラ/グループ のパスを組み立てる", () => {
    const dir = buildReleaseDir("X:\\", new Date(2026, 10, 2), "エレン・ジョー", "前戯・フェラ");
    expect(dir).toBe(path.join("X:\\", "202611", "20261102_エレン・ジョー", "前戯・フェラ"));
  });

  it("名前が空、または使えない文字だけなら null", () => {
    expect(buildReleaseDir("X:\\", new Date(), "", "a")).toBeNull();
    expect(buildReleaseDir("X:\\", new Date(), "a", "?*")).toBeNull();
  });

  it("フォルダ名に使えない文字を除く", () => {
    expect(sanitizeFolderName(' a/b:c*d "e" ')).toBe("abcd e");
  });

  it("元の順に01,02,...へ振り直し、拡張子は維持する", () => {
    expect(numberedNames(["a.JPG", "b.png", "c.webp"], 1)).toEqual(["01.jpg", "02.png", "03.webp"]);
  });

  it("100枚を超えるなら桁を広げ、続き番号から振れる", () => {
    const names = numberedNames(Array.from({ length: 3 }, () => "x.jpg"), 99);
    expect(names).toEqual(["099.jpg", "100.jpg", "101.jpg"]);
    expect(maxExistingSequence(["01.jpg", "07.png", "memo.txt", "x_08.jpg"])).toBe(7);
  });
});
