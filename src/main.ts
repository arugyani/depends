import {
  CachedMetadata,
  MarkdownView,
  Notice,
  Plugin,
  TAbstractFile,
  TFile,
} from "obsidian";

import { debounce, DebouncedFn } from "./debounce";
import { FileEntryInput, IdIndex } from "./index";
import { parseId } from "./parse-id";
import {
  normalizeIds,
  renderBlock,
  ResolverIndex,
  ResolverSettings,
} from "./resolver";
import { hasSection, replaceSection, stripLegacyBlock } from "./section";
import { shouldTrack } from "./scope";
import {
  DEFAULT_SETTINGS,
  DependsSettings,
  DependsSettingTab,
} from "./settings";
import { StatsModal } from "./stats-modal";

const DEBOUNCE_MS = 400;

export default class DependsPlugin extends Plugin {
  settings!: DependsSettings;
  index!: IdIndex;

  private readonly perFileQueues = new Map<string, DebouncedFn<[]>>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.index = new IdIndex();

    this.addSettingTab(new DependsSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      void this.initialBuild();
    });

    this.registerEvent(
      this.app.metadataCache.on("changed", (file: TFile) => {
        this.handleChanged(file);
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on("deleted", (file: TFile) => {
        this.handleDeleted(file);
      }),
    );

    this.registerEvent(
      this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) this.handleRenamed(file, oldPath);
      }),
    );

    this.addCommand({
      id: "register-all",
      name: "Register dependencies for all files",
      callback: () => {
        void this.rebuildAll(true);
      },
    });

    this.addCommand({
      id: "register-current",
      name: "Register dependencies for current file",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) {
          void this.registerCurrent(file);
        }
        return true;
      },
    });

    this.addCommand({
      id: "show-index-stats",
      name: "Show index stats",
      callback: () => {
        new StatsModal(this.app, {
          mode: this.settings.mode,
          index: this.index,
        }).open();
      },
    });
  }

  onunload(): void {
    for (const q of this.perFileQueues.values()) q.cancel();
    this.perFileQueues.clear();
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<DependsSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private resolverSettings(): ResolverSettings {
    const s = this.settings;
    return {
      idField: s.idField,
      dependenciesField: s.dependenciesField,
      dependentsField: s.dependentsField,
      gateField: s.gateField,
      enableDependencies: s.enableDependencies,
      enableDependents: s.enableDependents,
      dependentsMode: s.dependentsMode,
    };
  }

  private inScope(path: string): boolean {
    return shouldTrack(path, {
      includeFolders: this.settings.includeFolders,
      excludeFolders: this.settings.excludeFolders,
    });
  }

  private extractEntry(cache: CachedMetadata | null): FileEntryInput {
    const fm = cache?.frontmatter ?? null;
    if (!fm) return { id: null, dependencies: [], dependents: [] };
    return {
      id: parseId(fm[this.settings.idField]),
      dependencies: normalizeIds(fm[this.settings.dependenciesField]),
      dependents: normalizeIds(fm[this.settings.dependentsField]),
    };
  }

  private hasManagedFrontmatter(cache: CachedMetadata | null): boolean {
    const fm = cache?.frontmatter ?? null;
    if (!fm) return false;
    const s = this.settings;
    return (
      s.idField in fm ||
      s.dependenciesField in fm ||
      s.dependentsField in fm ||
      (s.gateField !== "" && s.gateField in fm)
    );
  }

  private buildResolverIndex(sourcePath: string): ResolverIndex {
    return {
      linkTextForId: (id) => {
        const path = this.index.primaryPathForId(id);
        if (!path) return null;
        const f = this.app.vault.getAbstractFileByPath(path);
        if (!(f instanceof TFile)) return null;
        return this.app.metadataCache.fileToLinktext(f, sourcePath, true);
      },
      inferredDependentIds: (id) => this.index.inferredDependentIds(id),
    };
  }

  private indexAll(): void {
    this.index.clear();
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      if (!this.inScope(file.path)) continue;
      try {
        const cache = this.app.metadataCache.getFileCache(file);
        const entry = this.extractEntry(cache);
        this.index.setFile(file.path, entry);
      } catch (err) {
        console.error(`[depends] index error for ${file.path}:`, err);
      }
    }
  }

  private async writeAll(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      if (!this.inScope(file.path)) continue;
      try {
        await this.writeFileSections(file);
      } catch (err) {
        console.error(`[depends] write error for ${file.path}:`, err);
      }
    }
  }

  private async initialBuild(): Promise<void> {
    this.indexAll();
    if (this.settings.mode === "auto") {
      await this.writeAll();
    }
  }

  async rebuildAll(notify = false): Promise<void> {
    this.indexAll();
    await this.writeAll();
    if (notify) new Notice("Depends: registered all files");
  }

  private async registerCurrent(file: TFile): Promise<void> {
    if (!this.inScope(file.path)) {
      new Notice("Depends: this file is outside the configured scope");
      return;
    }
    this.updateIndexFor(file);
    try {
      await this.writeFileSections(file);
      new Notice(`Depends: registered ${file.basename}`);
    } catch (err) {
      console.error(`[depends] register-current error for ${file.path}:`, err);
      new Notice(`Depends: failed to register ${file.basename} (see console)`);
    }
  }

  private updateIndexFor(file: TFile): {
    prev: FileEntryInput | null;
    next: FileEntryInput;
  } {
    const cache = this.app.metadataCache.getFileCache(file);
    const next = this.extractEntry(cache);
    const prev = this.index.getFile(file.path);
    this.index.setFile(file.path, next);
    return { prev, next };
  }

  private diffIds(prev: FileEntryInput | null, next: FileEntryInput): Set<string> {
    const ids = new Set<string>();
    if (prev?.id) ids.add(prev.id);
    if (next.id) ids.add(next.id);
    const prevDeps = prev ? new Set(prev.dependencies) : new Set<string>();
    const nextDeps = new Set(next.dependencies);
    for (const d of prevDeps) if (!nextDeps.has(d)) ids.add(d);
    for (const d of nextDeps) if (!prevDeps.has(d)) ids.add(d);
    return ids;
  }

  private cancelQueue(path: string): void {
    const q = this.perFileQueues.get(path);
    if (q) {
      q.cancel();
      this.perFileQueues.delete(path);
    }
  }

  private handleDeleted(file: TFile): void {
    this.cancelQueue(file.path);
    const old = this.index.getFile(file.path);
    this.index.removeFile(file.path);
    if (this.settings.mode !== "auto" || !old) return;
    const ids = new Set<string>();
    if (old.id) ids.add(old.id);
    for (const d of old.dependencies) ids.add(d);
    for (const d of old.dependents) ids.add(d);
    this.queueAffected(ids);
  }

  private handleRenamed(file: TFile, oldPath: string): void {
    this.cancelQueue(oldPath);
    this.index.renameFile(oldPath, file.path);
    if (this.settings.mode !== "auto") return;
    const entry = this.index.getFile(file.path);
    if (!entry?.id) return;
    this.queueFile(file.path);
    for (const p of this.index.filesAffectedByIdChange(entry.id)) {
      this.queueFile(p);
    }
  }

  private handleChanged(file: TFile): void {
    if (!this.inScope(file.path)) {
      this.cancelQueue(file.path);
      this.index.removeFile(file.path);
      return;
    }
    const { prev, next } = this.updateIndexFor(file);
    if (this.settings.mode !== "auto") return;
    const propagate = this.diffIds(prev, next);
    this.queueFile(file.path);
    this.queueAffected(propagate);
  }

  private queueFile(path: string): void {
    let q = this.perFileQueues.get(path);
    if (!q) {
      q = debounce(() => {
        const af = this.app.vault.getAbstractFileByPath(path);
        if (!(af instanceof TFile)) return;
        void this.writeFileSections(af).catch((err) => {
          console.error(`[depends] write error for ${af.path}:`, err);
        });
      }, DEBOUNCE_MS);
      this.perFileQueues.set(path, q);
    }
    q();
  }

  private queueAffected(ids: Iterable<string>): void {
    const seen = new Set<string>();
    for (const id of ids) {
      if (!id) continue;
      for (const p of this.index.filesAffectedByIdChange(id)) {
        if (!seen.has(p)) {
          seen.add(p);
          this.queueFile(p);
        }
      }
      for (const p of this.index.pathsForId(id)) {
        if (!seen.has(p)) {
          seen.add(p);
          this.queueFile(p);
        }
      }
    }
  }

  private findOpenView(file: TFile): MarkdownView | null {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === file.path) {
        return view;
      }
    }
    return null;
  }

  private async writeFileSections(file: TFile): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter ?? null;
    const s = this.settings;

    const openView = this.findOpenView(file);
    const original = openView
      ? openView.editor.getValue()
      : await this.app.vault.read(file);
    let working = stripLegacyBlock(original);

    const tracked = this.hasManagedFrontmatter(cache);
    const dependsHeading = s.dependsOnHeading;
    const dependentsHeading = s.dependentsHeading;
    const hadDependsSection = hasSection(working, dependsHeading);
    const hadDependentsSection = hasSection(working, dependentsHeading);

    if (
      !tracked &&
      !hadDependsSection &&
      !hadDependentsSection &&
      working === original
    ) {
      return;
    }

    let dependsBody = "";
    let dependentsBody = "";
    if (tracked) {
      const result = renderBlock({
        frontmatter: fm,
        index: this.buildResolverIndex(file.path),
        settings: this.resolverSettings(),
      });
      if (s.enableDependencies) dependsBody = result.dependsOnBody;
      if (s.enableDependents) dependentsBody = result.dependentsBody;
    }

    if (s.enableDependencies || hadDependsSection) {
      working = replaceSection(working, dependsHeading, dependsBody);
    }
    if (s.enableDependents || hadDependentsSection) {
      working = replaceSection(working, dependentsHeading, dependentsBody);
    }

    if (working === original) return;
    await this.commitWrite(file, working, openView);
  }

  private async commitWrite(
    file: TFile,
    content: string,
    view: MarkdownView | null,
  ): Promise<void> {
    if (view) {
      const editor = view.editor;
      const cursor = editor.getCursor();
      const scroll = editor.getScrollInfo();
      editor.setValue(content);
      const lineCount = editor.lineCount();
      const restoredLine = Math.min(cursor.line, Math.max(0, lineCount - 1));
      const lineLen = editor.getLine(restoredLine).length;
      editor.setCursor({ line: restoredLine, ch: Math.min(cursor.ch, lineLen) });
      editor.scrollTo(scroll.left, scroll.top);
      return;
    }
    await this.app.vault.modify(file, content);
  }
}
