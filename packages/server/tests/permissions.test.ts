import { resourceMatches } from "../src/permissions";

import { describe, expect, it } from "vitest";

describe("Permissions", () => {
  describe("resourceMatches", () => {
    it("should match exact resources", () => {
      expect(resourceMatches("a/b/c", "a/b/c")).toBe(true);
    });

    it("should match with global wildcard", () => {
      expect(resourceMatches("a/b/c", "*")).toBe(true);
    });

    it("should match with pattern matching only beginning", () => {
      expect(resourceMatches("a/b/c/d/e/f/g", "a/b")).toBe(true);
    });

    it("should match with single wildcard", () => {
      expect(resourceMatches("a/b/c", "a/b/*")).toBe(true);
      expect(resourceMatches("a/b/c/d", "a/b/*")).toBe(true);
      expect(resourceMatches("a/b/c/d/e", "a/b/*")).toBe(true);
      expect(resourceMatches("a/b/c", "a/b/c/d")).toBe(false);
    });

    it("should not match different resources", () => {
      expect(resourceMatches("a/b/c", "a/b/d")).toBe(false);
      expect(resourceMatches("a/b/c/d", "a/b/c/e")).toBe(false);
      expect(resourceMatches("a/b/c/d/e", "a/b/c/d/f")).toBe(false);
      expect(resourceMatches("a/b/", "a/b/c/d/f")).toBe(false);
    });
  });
});
