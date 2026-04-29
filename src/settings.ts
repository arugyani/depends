import { App, PluginSettingTab, Setting } from "obsidian";
import type DependsPlugin from "./main";
import type { DependentsMode } from "./resolver";
import { normalizeFolderList } from "./scope";

export type UpdateMode = "auto" | "manual";

export interface DependsSettings {
  mode: UpdateMode;
  idField: string;
  dependenciesField: string;
  dependentsField: string;
  gateField: string;
  enableDependencies: boolean;
  enableDependents: boolean;
  dependsOnHeading: string;
  dependentsHeading: string;
  includeFolders: string[];
  excludeFolders: string[];
  dependentsMode: DependentsMode;
}

export const DEFAULT_SETTINGS: DependsSettings = {
  mode: "auto",
  idField: "id",
  dependenciesField: "dependencies",
  dependentsField: "dependents",
  gateField: "",
  enableDependencies: true,
  enableDependents: true,
  dependsOnHeading: "# Depends on",
  dependentsHeading: "# Dependents",
  includeFolders: [],
  excludeFolders: [],
  dependentsMode: "both",
};

function normalizeHeadingInput(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;
  if (/^#{1,6}\s/.test(trimmed)) return trimmed;
  return `# ${trimmed}`;
}

export class DependsSettingTab extends PluginSettingTab {
  private readonly plugin: DependsPlugin;

  constructor(app: App, plugin: DependsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const save = async (rebuild: boolean) => {
      await this.plugin.saveSettings();
      if (rebuild) await this.plugin.rebuildAll();
    };

    new Setting(containerEl).setName("Update mode").setHeading();

    new Setting(containerEl)
      .setName("Mode")
      .setDesc(
        "Auto: rewrites sections whenever frontmatter changes. Manual: index stays current but writes only happen when you invoke a command.",
      )
      .addDropdown((d) =>
        d
          .addOption("auto", "Auto")
          .addOption("manual", "Manual")
          .setValue(this.plugin.settings.mode)
          .onChange(async (v) => {
            this.plugin.settings.mode = v as UpdateMode;
            await save(false);
          }),
      );

    new Setting(containerEl).setName("Frontmatter fields").setHeading();

    new Setting(containerEl)
      .setName("Id field")
      .setDesc("Frontmatter key that holds each note's unique id.")
      .addText((t) =>
        t
          .setPlaceholder("id")
          .setValue(this.plugin.settings.idField)
          .onChange(async (v) => {
            this.plugin.settings.idField = v.trim() || "id";
            await save(true);
          }),
      );

    new Setting(containerEl)
      .setName("Dependencies field")
      .setDesc("Frontmatter key listing ids this note depends on.")
      .addText((t) =>
        t
          .setPlaceholder("dependencies")
          .setValue(this.plugin.settings.dependenciesField)
          .onChange(async (v) => {
            this.plugin.settings.dependenciesField = v.trim() || "dependencies";
            await save(true);
          }),
      );

    new Setting(containerEl)
      .setName("Dependents field")
      .setDesc("Frontmatter key listing ids that depend on this note.")
      .addText((t) =>
        t
          .setPlaceholder("dependents")
          .setValue(this.plugin.settings.dependentsField)
          .onChange(async (v) => {
            this.plugin.settings.dependentsField = v.trim() || "dependents";
            await save(true);
          }),
      );

    new Setting(containerEl)
      .setName("Gate field")
      .setDesc(
        "Optional. When this field is present and falsy, the managed sections render empty (and are removed). Leave blank to disable.",
      )
      .addText((t) =>
        t
          .setPlaceholder("solved")
          .setValue(this.plugin.settings.gateField)
          .onChange(async (v) => {
            this.plugin.settings.gateField = v.trim();
            await save(true);
          }),
      );

    new Setting(containerEl).setName("Directions").setHeading();

    new Setting(containerEl)
      .setName("Render dependencies")
      .setDesc("Maintain a 'Depends on' section.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableDependencies).onChange(async (v) => {
          this.plugin.settings.enableDependencies = v;
          await save(true);
        }),
      );

    new Setting(containerEl)
      .setName("Render dependents")
      .setDesc("Maintain a 'Dependents' section.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableDependents).onChange(async (v) => {
          this.plugin.settings.enableDependents = v;
          await save(true);
        }),
      );

    new Setting(containerEl)
      .setName("Dependents source")
      .setDesc(
        "How to populate dependents. 'declared' uses the dependents field literally. 'inferred' inverts every other note's dependencies. 'both' merges them.",
      )
      .addDropdown((d) =>
        d
          .addOption("declared", "Declared")
          .addOption("inferred", "Inferred")
          .addOption("both", "Both")
          .setValue(this.plugin.settings.dependentsMode)
          .onChange(async (v) => {
            this.plugin.settings.dependentsMode = v as DependentsMode;
            await save(true);
          }),
      );

    new Setting(containerEl).setName("Section headings").setHeading();

    new Setting(containerEl)
      .setName("Depends on heading")
      .setDesc(
        "Heading line for the upstream section. Use any heading level by prefixing with '#'. A bare phrase is treated as H1.",
      )
      .addText((t) =>
        t
          .setPlaceholder("# Depends on")
          .setValue(this.plugin.settings.dependsOnHeading)
          .onChange(async (v) => {
            this.plugin.settings.dependsOnHeading = normalizeHeadingInput(
              v,
              DEFAULT_SETTINGS.dependsOnHeading,
            );
            await save(true);
          }),
      );

    new Setting(containerEl)
      .setName("Dependents heading")
      .setDesc("Heading line for the inverse section.")
      .addText((t) =>
        t
          .setPlaceholder("# Dependents")
          .setValue(this.plugin.settings.dependentsHeading)
          .onChange(async (v) => {
            this.plugin.settings.dependentsHeading = normalizeHeadingInput(
              v,
              DEFAULT_SETTINGS.dependentsHeading,
            );
            await save(true);
          }),
      );

    new Setting(containerEl).setName("Scope").setHeading();

    new Setting(containerEl)
      .setName("Include folders")
      .setDesc(
        "Comma or newline separated folder paths. Empty means the whole vault is in scope.",
      )
      .addTextArea((t) => {
        t.setValue(this.plugin.settings.includeFolders.join("\n")).onChange(
          async (v) => {
            this.plugin.settings.includeFolders = normalizeFolderList(v);
            await save(true);
          },
        );
        t.inputEl.rows = 3;
      });

    new Setting(containerEl)
      .setName("Exclude folders")
      .setDesc("Folders to skip even if they fall under the include list.")
      .addTextArea((t) => {
        t.setValue(this.plugin.settings.excludeFolders.join("\n")).onChange(
          async (v) => {
            this.plugin.settings.excludeFolders = normalizeFolderList(v);
            await save(true);
          },
        );
        t.inputEl.rows = 3;
      });
  }
}
