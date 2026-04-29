export interface ScopeSettings {
  readonly includeFolders: readonly string[];
  readonly excludeFolders: readonly string[];
}

function normalizeFolder(folder: string): string {
  let f = folder.trim();
  if (f === "" || f === "/") return "";
  while (f.startsWith("/")) f = f.slice(1);
  while (f.endsWith("/")) f = f.slice(0, -1);
  return f;
}

export function normalizeFolderList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map(normalizeFolder)
    .filter((s) => s.length > 0);
}

function isInFolder(path: string, normalizedFolder: string): boolean {
  if (normalizedFolder === "") return true;
  return path === normalizedFolder || path.startsWith(normalizedFolder + "/");
}

export function shouldTrack(path: string, settings: ScopeSettings): boolean {
  const includes: string[] = [];
  for (const f of settings.includeFolders) {
    const n = normalizeFolder(f);
    if (n !== "") includes.push(n);
  }
  const excludes: string[] = [];
  for (const f of settings.excludeFolders) {
    const n = normalizeFolder(f);
    if (n !== "") excludes.push(n);
  }
  if (includes.length > 0 && !includes.some((f) => isInFolder(path, f))) return false;
  if (excludes.some((f) => isInFolder(path, f))) return false;
  return true;
}
