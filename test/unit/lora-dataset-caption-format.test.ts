import { describe, expect, it } from "vitest";
import { buildCaption, captionTags, formatTag, reconcileTagLists } from "@/lib/lora-dataset/caption-format";
import type { DatasetImageManifest, DatasetMeta } from "@/lib/lora-dataset/types";

function makeMeta(overrides: Partial<DatasetMeta> = {}): DatasetMeta {
  return {
    name: "mychar",
    repeat: 10,
    triggerWord: "mychar",
    includeCategories: ["general", "character"],
    createdAt: 0,
    ...overrides,
  };
}

function makeManifest(overrides: Partial<DatasetImageManifest> = {}): DatasetImageManifest {
  return {
    danbooruId: 1,
    source: "",
    rating: "g",
    fileExt: "png",
    tags: {
      general: ["long_hair", "blue_eyes"],
      character: ["nazuna_(mychar)"],
      copyright: ["mychar_series"],
      artist: ["some_artist"],
      meta: ["highres"],
    },
    removedTags: [],
    extraTags: [],
    addedAt: 0,
    ...overrides,
  };
}

describe("formatTag", () => {
  it("converts underscores to spaces", () => {
    expect(formatTag("long_hair")).toBe("long hair");
  });

  it("keeps known emoticon tags with underscores intact", () => {
    expect(formatTag("^_^")).toBe("^_^");
    expect(formatTag("0_0")).toBe("0_0");
  });

  it("escapes parentheses", () => {
    expect(formatTag("dress_(medium)")).toBe("dress \\(medium\\)");
  });

  it("is idempotent (does not double-escape an already-formatted tag)", () => {
    const once = formatTag("dress_(medium)");
    expect(formatTag(once)).toBe(once);
  });
});

describe("captionTags / buildCaption", () => {
  it("includes only categories in includeCategories, in general/character/copyright/artist/meta order", () => {
    const meta = makeMeta({ includeCategories: ["character", "general"] });
    const manifest = makeManifest();
    expect(captionTags(meta, manifest)).toEqual(["long hair", "blue eyes", "nazuna \\(mychar\\)"]);
  });

  it("excludes removedTags and appends extraTags, deduplicated", () => {
    const meta = makeMeta();
    const manifest = makeManifest({
      removedTags: ["blue eyes"],
      extraTags: ["smile", "long hair"],
    });
    expect(captionTags(meta, manifest)).toEqual(["long hair", "nazuna \\(mychar\\)", "smile"]);
  });

  it("prefixes the caption with the trigger word", () => {
    const meta = makeMeta({ triggerWord: "mychar", includeCategories: ["general"] });
    const manifest = makeManifest({ tags: { ...makeManifest().tags, general: ["smile"] } });
    expect(buildCaption(meta, manifest)).toBe("mychar, smile");
  });

  it("omits the trigger word entirely when unset", () => {
    const meta = makeMeta({ triggerWord: "", includeCategories: ["general"] });
    const manifest = makeManifest({ tags: { ...makeManifest().tags, general: ["smile"] } });
    expect(buildCaption(meta, manifest)).toBe("smile");
  });

  it("formats the trigger word (underscore -> space) instead of inserting it raw", () => {
    const meta = makeMeta({ triggerWord: "inuwaka_nazuna", includeCategories: ["general"] });
    const manifest = makeManifest({ tags: { ...makeManifest().tags, general: ["smile"] } });
    expect(buildCaption(meta, manifest)).toBe("inuwaka nazuna, smile");
  });

  it("does not duplicate the trigger word when it matches an already-included tag (e.g. the character tag)", () => {
    const meta = makeMeta({ triggerWord: "inuwaka_nazuna", includeCategories: ["character"] });
    const manifest = makeManifest({
      tags: { ...makeManifest().tags, character: ["inuwaka_nazuna"] },
    });
    expect(buildCaption(meta, manifest)).toBe("inuwaka nazuna");
  });
});

describe("reconcileTagLists", () => {
  it("drops a tag from removedTags when it also appears in extraTags (re-adding a removed tag)", () => {
    const result = reconcileTagLists(["long hair", "blue eyes"], ["long hair"]);
    expect(result.removedTags).toEqual(["blue eyes"]);
    expect(result.extraTags).toEqual(["long hair"]);
  });

  it("deduplicates extraTags", () => {
    const result = reconcileTagLists([], ["smile", "smile"]);
    expect(result.extraTags).toEqual(["smile"]);
  });
});
