import { describe, expect, it } from "vitest";
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
