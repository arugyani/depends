import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IdIndex } from "../src/index";
import {
  ResolverIndex,
  ResolverSettings,
  normalizeIds,
  renderBlock,
} from "../src/resolver";

const VAULT_DIR = join(__dirname, "fixtures", "sample-vault");

interface ParsedNote {
  path: string;
  basename: string;
  frontmatter: Record<string, unknown>;
}

function parseFrontmatter(text: string): Record<string, unknown> {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return {};
  const out: Record<string, unknown> = {};
  for (const rawLine of m[1].split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val: string = line.slice(idx + 1).trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      const items = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      out[key] = items;
      continue;
    }
    if (val === "true") {
      out[key] = true;
      continue;
    }
    if (val === "false") {
      out[key] = false;
      continue;
    }
    if (/^-?\d+$/.test(val)) {
      out[key] = Number(val);
      continue;
    }
    out[key] = val;
  }
  return out;
}

function loadVault(): ParsedNote[] {
  return readdirSync(VAULT_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const path = `${f}`;
      const text = readFileSync(join(VAULT_DIR, f), "utf8");
      return {
        path,
        basename: f.replace(/\.md$/, ""),
        frontmatter: parseFrontmatter(text),
      };
    });
}

const settings: ResolverSettings = {
  idField: "id",
  dependenciesField: "dependencies",
  dependentsField: "dependents",
  gateField: "solved",
  enableDependencies: true,
  enableDependents: true,
  dependentsMode: "both",
};

describe("fixture vault end-to-end", () => {
  const notes = loadVault();
  const ix = new IdIndex();
  const basenames = new Map<string, string>();

  for (const n of notes) {
    const fm = n.frontmatter;
    const id = typeof fm.id === "string" ? fm.id : null;
    if (id) basenames.set(id, n.basename);
    ix.setFile(n.path, {
      id,
      dependencies: normalizeIds(fm.dependencies),
      dependents: normalizeIds(fm.dependents),
    });
  }

  const buildResolverIndex = (): ResolverIndex => ({
    linkTextForId: (id) => basenames.get(id) ?? null,
    inferredDependentIds: (id) => ix.inferredDependentIds(id),
  });

  it("renders basics with intro as a dependency and side+advanced as dependents", () => {
    const note = notes.find((n) => n.basename === "basics")!;
    const out = renderBlock({
      frontmatter: note.frontmatter,
      index: buildResolverIndex(),
      settings,
    });
    expect(out.dependsOnBody).toBe("- [[intro]]");
    expect(out.dependentsBody).toContain("[[advanced]]");
    expect(out.dependentsBody).toContain("[[sidequest]]");
  });

  it("gates advanced because solved is false", () => {
    const note = notes.find((n) => n.basename === "advanced")!;
    const out = renderBlock({
      frontmatter: note.frontmatter,
      index: buildResolverIndex(),
      settings,
    });
    expect(out.dependsOnBody).toBe("");
    expect(out.dependentsBody).toBe("");
  });

  it("flags missing-id as dangling for sidequest", () => {
    const note = notes.find((n) => n.basename === "sidequest")!;
    const out = renderBlock({
      frontmatter: note.frontmatter,
      index: buildResolverIndex(),
      settings,
    });
    expect(out.missingIds).toContain("missing-id");
    expect(out.dependsOnBody).toContain("[[basics]]");
  });

  it("intro infers basics as a dependent", () => {
    const note = notes.find((n) => n.basename === "intro")!;
    const out = renderBlock({
      frontmatter: note.frontmatter,
      index: buildResolverIndex(),
      settings,
    });
    expect(out.dependentsBody).toBe("- [[basics]]");
  });

  it("expert resolves dependency on advanced even though advanced is gated", () => {
    const note = notes.find((n) => n.basename === "expert")!;
    const out = renderBlock({
      frontmatter: note.frontmatter,
      index: buildResolverIndex(),
      settings,
    });
    expect(out.dependsOnBody).toContain("[[advanced]]");
  });

  it("IdIndex flags the dangling id from sidequest", () => {
    expect(ix.danglingIds()).toContain("missing-id");
  });
});
