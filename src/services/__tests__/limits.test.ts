import { describe, expect, it } from "vitest";
import {
  evaluateLimit,
  LimitError,
  maxForKind,
  type LimitKind,
} from "@/lib/limits";

describe("evaluateLimit", () => {
  it("allows when under the limit", () => {
    expect(evaluateLimit(2, 3)).toEqual({ allowed: true, current: 2, max: 3 });
  });

  it("rejects when at the limit (silver firm's 4th associate)", () => {
    // silver allows 3 associates; the firm already has 3
    expect(evaluateLimit(3, 3)).toEqual({ allowed: false, current: 3, max: 3 });
  });

  it("rejects when over the limit", () => {
    expect(evaluateLimit(5, 3).allowed).toBe(false);
  });

  it("treats -1 as unlimited (platinum)", () => {
    expect(evaluateLimit(0, -1).allowed).toBe(true);
    expect(evaluateLimit(10_000, -1).allowed).toBe(true);
  });

  it("rejects when max is 0", () => {
    expect(evaluateLimit(0, 0).allowed).toBe(false);
  });
});

describe("maxForKind", () => {
  const silver = { maxAssociates: 3, maxActiveProjects: 10, maxClients: 25 };

  it.each<[LimitKind, number]>([
    ["associates", 3],
    ["projects", 10],
    ["clients", 25],
  ])("maps %s to the right plan column", (kind, expected) => {
    expect(maxForKind(silver, kind)).toBe(expected);
  });
});

describe("LimitError", () => {
  it("carries a friendly upgrade-prompt message", () => {
    const err = new LimitError("associates", {
      allowed: false,
      current: 3,
      max: 3,
    });
    expect(err.message).toContain("Your plan allows 3 associates");
    expect(err.message).toContain("Upgrade your plan");
    expect(err.name).toBe("LimitError");
    expect(err.kind).toBe("associates");
  });

  it("is an instance of Error for action-layer mapping", () => {
    const err = new LimitError("clients", {
      allowed: false,
      current: 25,
      max: 25,
    });
    expect(err).toBeInstanceOf(Error);
  });
});
