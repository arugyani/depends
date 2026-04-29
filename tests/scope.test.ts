import { describe, expect, it } from "vitest";
import { shouldTrack } from "../src/scope";

describe("scope", () => {
  it("tracks all files when both lists are empty", () => {
    expect(shouldTrack("a.md", { includeFolders: [], excludeFolders: [] })).toBe(true);
    expect(
      shouldTrack("deep/nested/file.md", { includeFolders: [], excludeFolders: [] }),
    ).toBe(true);
  });

  it("respects include-only", () => {
    const s = { includeFolders: ["notes"], excludeFolders: [] };
    expect(shouldTrack("notes/a.md", s)).toBe(true);
    expect(shouldTrack("notes/sub/a.md", s)).toBe(true);
    expect(shouldTrack("other/a.md", s)).toBe(false);
    expect(shouldTrack("a.md", s)).toBe(false);
  });

  it("respects exclude-only", () => {
    const s = { includeFolders: [], excludeFolders: ["archive"] };
    expect(shouldTrack("notes/a.md", s)).toBe(true);
    expect(shouldTrack("archive/a.md", s)).toBe(false);
    expect(shouldTrack("archive/sub/a.md", s)).toBe(false);
  });

  it("applies exclude on top of include", () => {
    const s = { includeFolders: ["notes"], excludeFolders: ["notes/draft"] };
    expect(shouldTrack("notes/a.md", s)).toBe(true);
    expect(shouldTrack("notes/draft/a.md", s)).toBe(false);
    expect(shouldTrack("other/a.md", s)).toBe(false);
  });

  it("treats / and empty entries as whole-vault", () => {
    const s = { includeFolders: ["/"], excludeFolders: [""] };
    expect(shouldTrack("a.md", s)).toBe(true);
    expect(shouldTrack("deep/a.md", s)).toBe(true);
  });

  it("normalizes trailing and leading slashes", () => {
    const s = { includeFolders: ["/notes/"], excludeFolders: [] };
    expect(shouldTrack("notes/a.md", s)).toBe(true);
    expect(shouldTrack("notes-other/a.md", s)).toBe(false);
  });

  it("matches root-level files only when include is empty", () => {
    const s = { includeFolders: ["sub"], excludeFolders: [] };
    expect(shouldTrack("root.md", s)).toBe(false);
  });
});
