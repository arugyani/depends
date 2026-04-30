# Depends

[![Submission](https://img.shields.io/github/issues/detail/state/obsidianmd/obsidian-releases/12416?label=community%20plugins%20PR)](https://github.com/obsidianmd/obsidian-releases/pull/12416) [![Review status](https://img.shields.io/github/issues/detail/label/obsidianmd/obsidian-releases/12416?label=status)](https://github.com/obsidianmd/obsidian-releases/pull/12416)

Manage file dependencies for better graph viewing.

## What it does

Declare relationships between notes by id in frontmatter, and Depends writes real
`[[wikilinks]]` into managed sections of each note. The native Obsidian graph
view picks up those edges automatically. The user only types ids. Depends resolves
them to filenames, so renaming a note does not break the graph.

## Frontmatter example

```yaml
---
id: ini1
solved: true
dependencies: [ini0]
dependents: [ini2, ini3]
---
```

The plugin maintains two sections in the note:

```
# Depends on
- [[intro]]

# Dependents
- [[advanced]]
- [[expert]]
```

You do not have to add the headings yourself. They appear (and disappear) as
soon as the relationships are present (or removed).

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| Mode | `auto` | `auto` rewrites sections whenever frontmatter changes. `manual` only writes when you run a command. The index stays current in both modes. |
| Id field | `id` | Frontmatter key holding each note's unique id. |
| Dependencies field | `dependencies` | Ids this note depends on. |
| Dependents field | `dependents` | Ids that depend on this note (declared). |
| Gate field | empty | Optional. Set to a frontmatter key (such as `solved`); when that key is present and falsy, both managed sections are removed. Leave blank to disable gating. |
| Render dependencies | on | Toggle the upstream direction. |
| Render dependents | on | Toggle the inverse direction. |
| Dependents source | both | `declared`, `inferred`, or `both`. Inferred dependents come from inverting every other note's dependencies. |
| Depends on heading | `# Depends on` | Heading line for the upstream section. Any heading level (`#`..`######`) works. |
| Dependents heading | `# Dependents` | Heading line for the inverse section. |
| Include / exclude folders | empty | Empty include means the whole vault is in scope. Exclude wins over include. |

A managed section owns its heading plus the contiguous bullet lines beneath
it. Anything that is neither a bullet nor a blank line ends the section, so
prose written after the bullets is preserved.

## Commands

* Depends: Register dependencies for all files
* Depends: Register dependencies for current file
* Depends: Show index stats

In manual mode these commands are how you ask Depends to write. In auto mode you
rarely need them, but they remain useful for forcing a refresh.

## Install

### From the community plugin directory

Once Depends is published, install it from inside Obsidian via Settings,
Community plugins, Browse. Search for "Depends", install, and enable.

### Manually from a release

1. Download `main.js` and `manifest.json` from the
   [latest release](../../releases/latest).
2. Drop them into `<vault>/.obsidian/plugins/depends/`.
3. Reload Obsidian and enable "Depends" under Community plugins.

### From source (for local development)

1. Run `npm install`.
2. Run `npm run build`. This produces `main.js` next to `manifest.json`.
3. Run `scripts/install.sh vaults verbose` to pick a vault interactively, or
   `scripts/install.sh install <vault-name>` to target one directly.
4. Reload Obsidian and enable "Depends" under Community plugins.

For development, `npm run dev` will watch and rebuild on save.

## Develop

* `npm run build` produces a single `main.js`.
* `npm test` runs the test suite (Vitest).
* `npm run typecheck` runs TypeScript with no emit.

## License

MIT
