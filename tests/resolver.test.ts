import { describe, expect, it } from "vitest";
import {
  ResolverIndex,
  ResolverSettings,
  normalizeIds,
  renderBlock,
} from "../src/resolver";

const baseSettings: ResolverSettings = {
  idField: "id",
  dependenciesField: "dependencies",
  dependentsField: "dependents",
  gateField: "solved",
  enableDependencies: true,
  enableDependents: true,
  dependentsMode: "both",
};

class StubIndex implements ResolverIndex {
  private readonly idToLink: Map<string, string>;
  private readonly inferred: Map<string, readonly string[]>;
  constructor(
    idToLink: Record<string, string>,
    inferred: Record<string, readonly string[]> = {},
  ) {
    this.idToLink = new Map(Object.entries(idToLink));
    this.inferred = new Map(Object.entries(inferred));
  }
  linkTextForId(id: string): string | null {
    return this.idToLink.get(id) ?? null;
  }
  inferredDependentIds(id: string): readonly string[] {
    return this.inferred.get(id) ?? [];
  }
}

describe("normalizeIds", () => {
  it("accepts arrays of strings", () => {
    expect(normalizeIds(["a", "b"])).toEqual(["a", "b"]);
  });
  it("trims and drops empty entries", () => {
    expect(normalizeIds(["  a  ", "", "b"])).toEqual(["a", "b"]);
  });
  it("splits comma strings", () => {
    expect(normalizeIds("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("returns [] for null/undefined/objects", () => {
    expect(normalizeIds(null)).toEqual([]);
    expect(normalizeIds(undefined)).toEqual([]);
    expect(normalizeIds({})).toEqual([]);
  });
});

describe("renderBlock", () => {
  it("renders both bodies as bullet lists", () => {
    const fm = { id: "self", dependencies: ["a"], dependents: ["b"] };
    const idx = new StubIndex({ a: "Note A", b: "Note B" });
    const out = renderBlock({ frontmatter: fm, index: idx, settings: baseSettings });
    expect(out.dependsOnBody).toBe("- [[Note A]]");
    expect(out.dependentsBody).toBe("- [[Note B]]");
    expect(out.missingIds).toEqual([]);
  });

  it("renders only deps when dependents disabled", () => {
    const fm = { id: "self", dependencies: ["a"], dependents: ["b"] };
    const idx = new StubIndex({ a: "A", b: "B" });
    const out = renderBlock({
      frontmatter: fm,
      index: idx,
      settings: { ...baseSettings, enableDependents: false },
    });
    expect(out.dependsOnBody).toBe("- [[A]]");
    expect(out.dependentsBody).toBe("");
  });

  it("renders only dependents when dependencies disabled", () => {
    const fm = { id: "self", dependencies: ["a"], dependents: ["b"] };
    const idx = new StubIndex({ a: "A", b: "B" });
    const out = renderBlock({
      frontmatter: fm,
      index: idx,
      settings: { ...baseSettings, enableDependencies: false },
    });
    expect(out.dependsOnBody).toBe("");
    expect(out.dependentsBody).toBe("- [[B]]");
  });

  it("returns empty bodies when nothing to render", () => {
    const fm = { id: "self" };
    const idx = new StubIndex({});
    const out = renderBlock({ frontmatter: fm, index: idx, settings: baseSettings });
    expect(out.dependsOnBody).toBe("");
    expect(out.dependentsBody).toBe("");
  });

  it("gates output when gateField is present and falsy", () => {
    const fm = { id: "self", solved: false, dependencies: ["a"] };
    const idx = new StubIndex({ a: "A" });
    const out = renderBlock({ frontmatter: fm, index: idx, settings: baseSettings });
    expect(out.dependsOnBody).toBe("");
    expect(out.dependentsBody).toBe("");
  });

  it("does NOT gate when gateField is missing", () => {
    const fm = { id: "self", dependencies: ["a"] };
    const idx = new StubIndex({ a: "A" });
    const out = renderBlock({ frontmatter: fm, index: idx, settings: baseSettings });
    expect(out.dependsOnBody).toContain("[[A]]");
  });

  it("does NOT gate when gateField is truthy", () => {
    const fm = { id: "self", solved: true, dependencies: ["a"] };
    const idx = new StubIndex({ a: "A" });
    const out = renderBlock({ frontmatter: fm, index: idx, settings: baseSettings });
    expect(out.dependsOnBody).toContain("[[A]]");
  });

  it("treats empty string and 0 as gated", () => {
    const idx = new StubIndex({ a: "A" });
    for (const v of [0, "", null]) {
      const fm = { id: "self", solved: v, dependencies: ["a"] };
      const out = renderBlock({ frontmatter: fm, index: idx, settings: baseSettings });
      expect(out.dependsOnBody).toBe("");
    }
  });

  it("gating is off when gateField setting is empty", () => {
    const fm = { id: "self", solved: false, dependencies: ["a"] };
    const idx = new StubIndex({ a: "A" });
    const out = renderBlock({
      frontmatter: fm,
      index: idx,
      settings: { ...baseSettings, gateField: "" },
    });
    expect(out.dependsOnBody).toContain("[[A]]");
  });

  it("reports missing (dangling) ids", () => {
    const fm = { id: "self", dependencies: ["known", "missing"] };
    const idx = new StubIndex({ known: "Known" });
    const out = renderBlock({ frontmatter: fm, index: idx, settings: baseSettings });
    expect(out.dependsOnBody).toContain("[[Known]]");
    expect(out.dependsOnBody).not.toContain("[[missing]]");
    expect(out.missingIds).toContain("missing");
  });

  it("dedupes declared and inferred dependents", () => {
    const fm = { id: "self", dependents: ["a"] };
    const idx = new StubIndex({ a: "A" }, { self: ["a"] });
    const out = renderBlock({
      frontmatter: fm,
      index: idx,
      settings: { ...baseSettings, enableDependencies: false },
    });
    expect(out.dependentsBody).toBe("- [[A]]");
  });

  it("respects dependentsMode = declared", () => {
    const fm = { id: "self", dependents: ["a"] };
    const idx = new StubIndex({ a: "A", b: "B" }, { self: ["b"] });
    const out = renderBlock({
      frontmatter: fm,
      index: idx,
      settings: {
        ...baseSettings,
        enableDependencies: false,
        dependentsMode: "declared",
      },
    });
    expect(out.dependentsBody).toBe("- [[A]]");
  });

  it("respects dependentsMode = inferred", () => {
    const fm = { id: "self", dependents: ["a"] };
    const idx = new StubIndex({ a: "A", b: "B" }, { self: ["b"] });
    const out = renderBlock({
      frontmatter: fm,
      index: idx,
      settings: {
        ...baseSettings,
        enableDependencies: false,
        dependentsMode: "inferred",
      },
    });
    expect(out.dependentsBody).toBe("- [[B]]");
  });

  it("excludes self-references", () => {
    const fm = { id: "self", dependencies: ["self", "a"] };
    const idx = new StubIndex({ a: "A", self: "Self" });
    const out = renderBlock({
      frontmatter: fm,
      index: idx,
      settings: { ...baseSettings, enableDependents: false },
    });
    expect(out.dependsOnBody).toBe("- [[A]]");
  });

  it("returns empty when all relationships are dangling", () => {
    const fm = { id: "self", dependencies: ["x", "y"] };
    const idx = new StubIndex({});
    const out = renderBlock({ frontmatter: fm, index: idx, settings: baseSettings });
    expect(out.dependsOnBody).toBe("");
    expect([...out.missingIds].sort()).toEqual(["x", "y"]);
  });

  it("dedupes by linktext", () => {
    const fm = { id: "self", dependencies: ["a", "b"] };
    const idx = new StubIndex({ a: "Same", b: "Same" });
    const out = renderBlock({
      frontmatter: fm,
      index: idx,
      settings: { ...baseSettings, enableDependents: false },
    });
    expect(out.dependsOnBody).toBe("- [[Same]]");
  });
});
