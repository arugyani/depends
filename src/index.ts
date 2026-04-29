export interface FileEntryInput {
  readonly id: string | null;
  readonly dependencies: readonly string[];
  readonly dependents: readonly string[];
}

export interface FileEntry extends FileEntryInput {
  readonly path: string;
}

export interface DuplicateIdReport {
  readonly id: string;
  readonly paths: readonly string[];
}

function addToMap(map: Map<string, Set<string>>, key: string, value: string): void {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}

function removeFromMap(
  map: Map<string, Set<string>>,
  key: string,
  value: string,
): void {
  const set = map.get(key);
  if (!set) return;
  set.delete(value);
  if (set.size === 0) map.delete(key);
}

export class IdIndex {
  private readonly byPath = new Map<string, FileEntry>();
  private readonly byId = new Map<string, Set<string>>();
  private readonly idDeclaredAsDep = new Map<string, Set<string>>();
  private readonly idDeclaredAsDependent = new Map<string, Set<string>>();

  setFile(path: string, entry: FileEntryInput): void {
    const old = this.byPath.get(path);
    if (old) this.removeFromIndices(old);
    const stored: FileEntry = {
      path,
      id: entry.id,
      dependencies: [...entry.dependencies],
      dependents: [...entry.dependents],
    };
    this.byPath.set(path, stored);
    if (stored.id) addToMap(this.byId, stored.id, path);
    for (const d of stored.dependencies) addToMap(this.idDeclaredAsDep, d, path);
    for (const d of stored.dependents) addToMap(this.idDeclaredAsDependent, d, path);
  }

  removeFile(path: string): void {
    const old = this.byPath.get(path);
    if (!old) return;
    this.removeFromIndices(old);
    this.byPath.delete(path);
  }

  renameFile(oldPath: string, newPath: string): void {
    if (oldPath === newPath) return;
    const old = this.byPath.get(oldPath);
    if (!old) return;
    this.removeFile(oldPath);
    this.setFile(newPath, {
      id: old.id,
      dependencies: old.dependencies,
      dependents: old.dependents,
    });
  }

  hasPath(path: string): boolean {
    return this.byPath.has(path);
  }

  getFile(path: string): FileEntry | null {
    return this.byPath.get(path) ?? null;
  }

  pathsForId(id: string): readonly string[] {
    const set = this.byId.get(id);
    return set ? [...set] : [];
  }

  primaryPathForId(id: string): string | null {
    const set = this.byId.get(id);
    if (!set || set.size === 0) return null;
    if (set.size === 1) return set.values().next().value as string;
    let best: string | null = null;
    for (const p of set) {
      if (best === null || p < best) best = p;
    }
    return best;
  }

  inferredDependentIds(id: string): readonly string[] {
    const paths = this.idDeclaredAsDep.get(id);
    if (!paths) return [];
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const p of paths) {
      const e = this.byPath.get(p);
      if (e?.id && !seen.has(e.id)) {
        seen.add(e.id);
        ids.push(e.id);
      }
    }
    return ids;
  }

  filesAffectedByIdChange(id: string): readonly string[] {
    const set = new Set<string>();
    const a = this.idDeclaredAsDep.get(id);
    const b = this.idDeclaredAsDependent.get(id);
    if (a) for (const p of a) set.add(p);
    if (b) for (const p of b) set.add(p);
    return [...set];
  }

  duplicateIds(): readonly DuplicateIdReport[] {
    const out: DuplicateIdReport[] = [];
    for (const [id, paths] of this.byId) {
      if (paths.size > 1) out.push({ id, paths: [...paths] });
    }
    return out;
  }

  danglingIds(): readonly string[] {
    const referenced = new Set<string>();
    for (const id of this.idDeclaredAsDep.keys()) referenced.add(id);
    for (const id of this.idDeclaredAsDependent.keys()) referenced.add(id);
    const dangling: string[] = [];
    for (const id of referenced) {
      if (!this.byId.has(id)) dangling.push(id);
    }
    return dangling;
  }

  size(): number {
    return this.byPath.size;
  }

  idCount(): number {
    return this.byId.size;
  }

  allFiles(): readonly FileEntry[] {
    return [...this.byPath.values()];
  }

  clear(): void {
    this.byPath.clear();
    this.byId.clear();
    this.idDeclaredAsDep.clear();
    this.idDeclaredAsDependent.clear();
  }

  private removeFromIndices(e: FileEntry): void {
    if (e.id) removeFromMap(this.byId, e.id, e.path);
    for (const d of e.dependencies) removeFromMap(this.idDeclaredAsDep, d, e.path);
    for (const d of e.dependents)
      removeFromMap(this.idDeclaredAsDependent, d, e.path);
  }
}
