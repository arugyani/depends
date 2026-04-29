# Depends

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

## License

MIT
