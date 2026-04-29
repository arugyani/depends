import { parseId } from "./parse-id";

export type DependentsMode = "declared" | "inferred" | "both";

export interface ResolverSettings {
  readonly idField: string;
  readonly dependenciesField: string;
  readonly dependentsField: string;
  readonly gateField: string;
  readonly enableDependencies: boolean;
  readonly enableDependents: boolean;
  readonly dependentsMode: DependentsMode;
}

export interface ResolverIndex {
  linkTextForId(id: string): string | null;
  inferredDependentIds(id: string): readonly string[];
}

export interface ResolverInput {
  readonly frontmatter: Record<string, unknown> | null;
  readonly index: ResolverIndex;
  readonly settings: ResolverSettings;
}

export interface RenderResult {
  readonly dependsOnBody: string;
  readonly dependentsBody: string;
  readonly missingIds: readonly string[];
}

export function normalizeIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      const id = parseId(item);
      if (id !== null) out.push(id);
    }
    return out;
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  const single = parseId(raw);
  return single !== null ? [single] : [];
}

function isGated(
  frontmatter: Record<string, unknown> | null,
  gateField: string,
): boolean {
  if (!gateField) return false;
  if (!frontmatter) return false;
  if (!(gateField in frontmatter)) return false;
  return !frontmatter[gateField];
}

function selfId(
  frontmatter: Record<string, unknown> | null,
  idField: string,
): string | null {
  if (!frontmatter) return null;
  return parseId(frontmatter[idField]);
}

function bulletList(links: readonly string[]): string {
  if (links.length === 0) return "";
  return links.map((l) => `- ${l}`).join("\n");
}

export function renderBlock(input: ResolverInput): RenderResult {
  const { frontmatter, index, settings } = input;
  const missing: string[] = [];

  if (isGated(frontmatter, settings.gateField)) {
    return { dependsOnBody: "", dependentsBody: "", missingIds: [] };
  }

  const id = selfId(frontmatter, settings.idField);

  const depIds: string[] = [];
  if (settings.enableDependencies && frontmatter) {
    depIds.push(...normalizeIds(frontmatter[settings.dependenciesField]));
  }

  const dependentIds: string[] = [];
  if (settings.enableDependents) {
    const declared =
      settings.dependentsMode !== "inferred" && frontmatter
        ? normalizeIds(frontmatter[settings.dependentsField])
        : [];
    const inferred =
      settings.dependentsMode !== "declared" && id !== null
        ? Array.from(index.inferredDependentIds(id))
        : [];
    const seen = new Set<string>();
    for (const x of [...declared, ...inferred]) {
      if (!seen.has(x)) {
        seen.add(x);
        dependentIds.push(x);
      }
    }
  }

  const resolveLinks = (ids: readonly string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const dep of ids) {
      if (id !== null && dep === id) continue;
      const link = index.linkTextForId(dep);
      if (link === null) {
        missing.push(dep);
        continue;
      }
      if (seen.has(link)) continue;
      seen.add(link);
      out.push(`[[${link}]]`);
    }
    return out;
  };

  const depLinks = resolveLinks(depIds);
  const dependentLinks = resolveLinks(dependentIds);

  return {
    dependsOnBody: bulletList(depLinks),
    dependentsBody: bulletList(dependentLinks),
    missingIds: missing,
  };
}
