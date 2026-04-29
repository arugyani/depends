import { App, Modal, Setting } from "obsidian";
import type { IdIndex } from "./index";
import type { UpdateMode } from "./settings";

export interface StatsModalInput {
  readonly mode: UpdateMode;
  readonly index: IdIndex;
}

export class StatsModal extends Modal {
  private readonly stats: StatsModalInput;

  constructor(app: App, stats: StatsModalInput) {
    super(app);
    this.stats = stats;
  }

  onOpen(): void {
    const { contentEl } = this;
    const { mode, index } = this.stats;
    contentEl.empty();
    new Setting(contentEl).setName("Index stats").setHeading();

    const list = contentEl.createEl("ul");
    list.createEl("li", { text: `Mode: ${mode}` });
    list.createEl("li", { text: `Tracked files: ${index.size()}` });
    list.createEl("li", { text: `Unique ids: ${index.idCount()}` });

    const dups = index.duplicateIds();
    list.createEl("li", { text: `Duplicate ids: ${dups.length}` });
    if (dups.length > 0) {
      const sub = contentEl.createEl("details");
      sub.createEl("summary", { text: "Duplicate id details" });
      for (const d of dups) {
        sub.createEl("div", { text: `${d.id}: ${d.paths.join(", ")}` });
      }
    }

    const dangling = index.danglingIds();
    list.createEl("li", { text: `Dangling references: ${dangling.length}` });
    if (dangling.length > 0) {
      const sub = contentEl.createEl("details");
      sub.createEl("summary", { text: "Dangling id details" });
      sub.createEl("div", { text: dangling.join(", ") });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
