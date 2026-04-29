function assertHeading(heading: string): string {
  const target = heading.trim();
  if (!/^#{1,6}\s/.test(target)) {
    throw new Error(
      `Depends: heading must start with '# ' through '###### ' (got "${heading}")`,
    );
  }
  return target;
}

interface FoundSection {
  readonly headingLine: number;
  readonly endLine: number;
}

function findSection(content: string, heading: string): FoundSection | null {
  const target = assertHeading(heading);
  const lines = content.split("\n");
  let headingLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === target) {
      headingLine = i;
      break;
    }
  }
  if (headingLine === -1) return null;
  let endLine = lines.length;
  for (let i = headingLine + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "") continue;
    if (/^[-*+] /.test(trimmed)) continue;
    endLine = i;
    break;
  }
  return { headingLine, endLine };
}

export function hasSection(content: string, heading: string): boolean {
  return findSection(content, heading) !== null;
}

export function parseSection(content: string, heading: string): string | null {
  const found = findSection(content, heading);
  if (!found) return null;
  const lines = content.split("\n");
  const body = lines.slice(found.headingLine + 1, found.endLine);
  while (body.length > 0 && body[body.length - 1].trim() === "") body.pop();
  return body.join("\n");
}

function joinAroundGap(
  before: readonly string[],
  middle: readonly string[],
  after: readonly string[],
): string {
  const b = [...before];
  const a = [...after];
  while (b.length > 0 && b[b.length - 1].trim() === "") b.pop();
  while (a.length > 0 && a[0].trim() === "") a.shift();
  const parts: string[] = [];
  if (b.length > 0) parts.push(b.join("\n"));
  if (middle.length > 0) parts.push(middle.join("\n"));
  if (a.length > 0) parts.push(a.join("\n"));
  if (parts.length === 0) return "";
  let result = parts.join("\n\n");
  if (a.length === 0) result += "\n";
  return result;
}

export function replaceSection(content: string, heading: string, body: string): string {
  const target = assertHeading(heading);
  const found = findSection(content, heading);
  const trimmedBody = body.replace(/\s+$/g, "");

  if (!found) {
    if (trimmedBody.length === 0) return content;
    const lines = content === "" ? [] : content.split("\n");
    const middle = [target, ...trimmedBody.split("\n")];
    return joinAroundGap(lines, middle, []);
  }

  const lines = content.split("\n");
  const before = lines.slice(0, found.headingLine);
  const after = lines.slice(found.endLine);

  if (trimmedBody.length === 0) {
    return joinAroundGap(before, [], after);
  }
  const middle = [target, ...trimmedBody.split("\n")];
  return joinAroundGap(before, middle, after);
}

const LEGACY_START = "%% deps-start %%";
const LEGACY_END = "%% deps-end %%";

export function stripLegacyBlock(content: string): string {
  const lines = content.split("\n");
  let s = -1;
  let e = -1;
  for (let i = 0; i < lines.length; i++) {
    if (s === -1 && lines[i].includes(LEGACY_START)) s = i;
    else if (s !== -1 && lines[i].includes(LEGACY_END)) {
      e = i;
      break;
    }
  }
  if (s === -1 || e === -1) return content;
  const before = lines.slice(0, s);
  const after = lines.slice(e + 1);
  return joinAroundGap(before, [], after);
}
