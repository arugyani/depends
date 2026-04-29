import { describe, expect, it } from "vitest";
import {
  hasSection,
  parseSection,
  replaceSection,
  stripLegacyBlock,
} from "../src/section";

const DEPENDS = "# Depends on";
const DEPENDENTS = "# Dependents";

describe("section parse / has", () => {
  it("returns null when section is missing", () => {
    expect(parseSection("# Other\nbody", DEPENDS)).toBeNull();
    expect(hasSection("# Other\nbody", DEPENDS)).toBe(false);
  });

  it("parses a section's body", () => {
    const c = `# Depends on\n- [[A]]\n- [[B]]\n\n# Other\nstuff`;
    expect(parseSection(c, DEPENDS)).toBe(`- [[A]]\n- [[B]]`);
    expect(hasSection(c, DEPENDS)).toBe(true);
  });

  it("section ends at end of file when no terminator", () => {
    const c = `# Depends on\n- [[A]]`;
    expect(parseSection(c, DEPENDS)).toBe(`- [[A]]`);
  });

  it("non-bullet content terminates the section", () => {
    const c = `# Depends on\n- [[A]]\n\nFooter prose.\n- [[Stray]]`;
    expect(parseSection(c, DEPENDS)).toBe(`- [[A]]`);
  });

  it("blank lines stay inside the section", () => {
    const c = `# Depends on\n- [[A]]\n\n- [[B]]\n\nfooter`;
    expect(parseSection(c, DEPENDS)).toBe(`- [[A]]\n\n- [[B]]`);
  });

  it("matches by heading-level too, not just substring", () => {
    const c = `## Depends on\nignored\n# Depends on\n- [[A]]`;
    expect(parseSection(c, DEPENDS)).toBe(`- [[A]]`);
  });
});

describe("replaceSection", () => {
  it("inserts a new section at end of file", () => {
    const c = `Some prose.`;
    const out = replaceSection(c, DEPENDS, `- [[A]]`);
    expect(out).toContain(`# Depends on\n- [[A]]\n`);
    expect(out.startsWith("Some prose.")).toBe(true);
  });

  it("does nothing when body is empty and section is missing", () => {
    const c = `Some prose.`;
    expect(replaceSection(c, DEPENDS, "")).toBe(c);
  });

  it("replaces existing body", () => {
    const c = `# Depends on\n- [[Old]]\n\n# Other\nx`;
    const out = replaceSection(c, DEPENDS, `- [[New]]`);
    expect(out).toBe(`# Depends on\n- [[New]]\n\n# Other\nx`);
  });

  it("removes section when body is empty", () => {
    const c = `intro\n\n# Depends on\n- [[A]]\n\n# Other\nx`;
    const out = replaceSection(c, DEPENDS, "");
    expect(out).toBe(`intro\n\n# Other\nx`);
  });

  it("keeps two managed sections side-by-side", () => {
    let c = `Body text.`;
    c = replaceSection(c, DEPENDS, `- [[A]]`);
    c = replaceSection(c, DEPENDENTS, `- [[B]]`);
    expect(c).toContain(`# Depends on\n- [[A]]`);
    expect(c).toContain(`# Dependents\n- [[B]]`);
    expect(c.indexOf("Depends on")).toBeLessThan(c.indexOf("Dependents"));
  });

  it("preserves content above and below the section", () => {
    const c = `# Title\n\nIntro paragraph.\n\n# Depends on\n- [[Old]]\n\nFooter line.`;
    const out = replaceSection(c, DEPENDS, `- [[New]]`);
    expect(out.startsWith(`# Title\n\nIntro paragraph.`)).toBe(true);
    expect(out).toContain(`# Depends on\n- [[New]]`);
    expect(out).toContain(`Footer line.`);
  });
});

describe("heading contract", () => {
  it("throws when heading is not actually a heading", () => {
    expect(() => replaceSection("body", "Depends on", "- [[A]]")).toThrow(/heading/);
    expect(() => replaceSection("body", "", "- [[A]]")).toThrow(/heading/);
    expect(() => replaceSection("body", "####### too deep", "- [[A]]")).toThrow();
  });
  it("accepts any level of valid heading", () => {
    for (const h of ["# A", "## A", "### A", "#### A", "##### A", "###### A"]) {
      expect(() => replaceSection("body", h, "- [[A]]")).not.toThrow();
    }
  });
});

describe("stripLegacyBlock", () => {
  it("removes %% deps-start %% / %% deps-end %% blocks", () => {
    const c = `intro\n\n%% deps-start %%\n[[Old]]\n%% deps-end %%\n\nfooter`;
    expect(stripLegacyBlock(c)).toBe(`intro\n\nfooter`);
  });

  it("is a no-op when no legacy block exists", () => {
    const c = `intro\n# Depends on\n- [[A]]`;
    expect(stripLegacyBlock(c)).toBe(c);
  });

  it("handles legacy block at end of file", () => {
    const c = `body\n\n%% deps-start %%\n%% deps-end %%\n`;
    const out = stripLegacyBlock(c);
    expect(out).toBe(`body\n`);
  });
});
