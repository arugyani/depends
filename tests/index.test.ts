import { describe, expect, it } from "vitest";
import { IdIndex } from "../src/index";

describe("IdIndex", () => {
  it("adds and retrieves entries", () => {
    const ix = new IdIndex();
    ix.setFile("a.md", { id: "a", dependencies: ["b"], dependents: [] });
    expect(ix.size()).toBe(1);
    expect(ix.primaryPathForId("a")).toBe("a.md");
    expect(ix.pathsForId("a")).toEqual(["a.md"]);
  });

  it("updates an existing entry without leaking old indices", () => {
    const ix = new IdIndex();
    ix.setFile("a.md", { id: "a", dependencies: ["b"], dependents: [] });
    ix.setFile("a.md", { id: "a2", dependencies: ["c"], dependents: [] });
    expect(ix.primaryPathForId("a")).toBeNull();
    expect(ix.primaryPathForId("a2")).toBe("a.md");
    expect(ix.filesAffectedByIdChange("b")).toEqual([]);
    expect(ix.filesAffectedByIdChange("c")).toEqual(["a.md"]);
  });

  it("removes entries and clears reverse indices", () => {
    const ix = new IdIndex();
    ix.setFile("a.md", { id: "a", dependencies: ["b"], dependents: ["c"] });
    ix.removeFile("a.md");
    expect(ix.size()).toBe(0);
    expect(ix.primaryPathForId("a")).toBeNull();
    expect(ix.filesAffectedByIdChange("b")).toEqual([]);
    expect(ix.filesAffectedByIdChange("c")).toEqual([]);
  });

  it("renames file paths while preserving entry data", () => {
    const ix = new IdIndex();
    ix.setFile("old.md", { id: "x", dependencies: ["y"], dependents: [] });
    ix.renameFile("old.md", "new.md");
    expect(ix.primaryPathForId("x")).toBe("new.md");
    expect(ix.filesAffectedByIdChange("y")).toEqual(["new.md"]);
  });

  it("detects duplicate ids", () => {
    const ix = new IdIndex();
    ix.setFile("a.md", { id: "shared", dependencies: [], dependents: [] });
    ix.setFile("b.md", { id: "shared", dependencies: [], dependents: [] });
    const dups = ix.duplicateIds();
    expect(dups).toHaveLength(1);
    expect(dups[0].id).toBe("shared");
    expect([...dups[0].paths].sort()).toEqual(["a.md", "b.md"]);
  });

  it("inferredDependentIds inverts dependency declarations", () => {
    const ix = new IdIndex();
    ix.setFile("a.md", { id: "a", dependencies: ["x"], dependents: [] });
    ix.setFile("b.md", { id: "b", dependencies: ["x"], dependents: [] });
    ix.setFile("x.md", { id: "x", dependencies: [], dependents: [] });
    expect([...ix.inferredDependentIds("x")].sort()).toEqual(["a", "b"]);
  });

  it("filesAffectedByIdChange unions both reverse indices", () => {
    const ix = new IdIndex();
    ix.setFile("a.md", { id: "a", dependencies: ["target"], dependents: [] });
    ix.setFile("b.md", { id: "b", dependencies: [], dependents: ["target"] });
    expect([...ix.filesAffectedByIdChange("target")].sort()).toEqual([
      "a.md",
      "b.md",
    ]);
  });

  it("reports dangling references", () => {
    const ix = new IdIndex();
    ix.setFile("a.md", {
      id: "a",
      dependencies: ["missing"],
      dependents: [],
    });
    expect(ix.danglingIds()).toEqual(["missing"]);
  });

  it("reverse-lookup remains correct across a chain of mutations", () => {
    const ix = new IdIndex();
    ix.setFile("a.md", { id: "a", dependencies: ["x", "y"], dependents: [] });
    ix.setFile("b.md", { id: "b", dependencies: ["x"], dependents: [] });
    ix.setFile("a.md", { id: "a", dependencies: ["y"], dependents: [] });
    expect([...ix.filesAffectedByIdChange("x")].sort()).toEqual(["b.md"]);
    expect([...ix.filesAffectedByIdChange("y")].sort()).toEqual(["a.md"]);
    ix.removeFile("b.md");
    expect(ix.filesAffectedByIdChange("x")).toEqual([]);
  });
});
