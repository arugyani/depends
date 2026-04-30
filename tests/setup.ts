// Obsidian injects `activeWindow` (and `activeDocument`) as globals at runtime,
// proxying to whichever window currently has focus. They are not available in
// the Node test environment, so we point them at globalThis here so vitest's
// fake-timer patches on global setTimeout/clearTimeout still flow through code
// that references activeWindow directly.
const g = globalThis as { activeWindow?: typeof globalThis; activeDocument?: unknown };
g.activeWindow = globalThis;
g.activeDocument =
  typeof document !== "undefined" ? document : undefined;
