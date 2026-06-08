import { describe, expect, it } from "vitest";
import { toUserErrorMessage } from "@/lib/firebase/errors";

describe("toUserErrorMessage", () => {
  it("falls back for a bare internal error", () => {
    expect(toUserErrorMessage("internal", "Failed to update items")).toBe("Failed to update items");
  });

  it("falls back for a callable-style internal error", () => {
    expect(toUserErrorMessage("[code=internal]: internal", "Failed to update items")).toBe("Failed to update items");
  });
});
