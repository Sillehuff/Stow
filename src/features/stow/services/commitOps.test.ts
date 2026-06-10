import { describe, expect, it } from "vitest";
import { chunkOps } from "./repository";

describe("chunkOps", () => {
  it("splits operations into <=450-op chunks preserving order", () => {
    const ops = Array.from({ length: 1000 }, (_, i) => i);
    const chunks = chunkOps(ops, 450);
    expect(chunks.map((c) => c.length)).toEqual([450, 450, 100]);
    expect(chunks.flat()).toEqual(ops);
  });
});
