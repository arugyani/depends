import { describe, expect, it } from "vitest";
import { parseId } from "../src/parse-id";

describe("parseId", () => {
  it("trims strings", () => {
    expect(parseId("  hi  ")).toBe("hi");
  });
  it("rejects empty / whitespace strings", () => {
    expect(parseId("")).toBeNull();
    expect(parseId("   ")).toBeNull();
  });
  it("stringifies numbers (including 0)", () => {
    expect(parseId(0)).toBe("0");
    expect(parseId(42)).toBe("42");
    expect(parseId(-1)).toBe("-1");
  });
  it("returns null for unsupported types", () => {
    expect(parseId(null)).toBeNull();
    expect(parseId(undefined)).toBeNull();
    expect(parseId(true)).toBeNull();
    expect(parseId({})).toBeNull();
    expect(parseId([])).toBeNull();
  });
});
