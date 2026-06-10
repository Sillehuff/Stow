import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Usage-doc ref sentinel returned by db.doc(...). tx.get/tx.set assert against identity.
const usageRef = { path: "households/h1/settings/visionUsage" };

const tx = {
  get: vi.fn(),
  set: vi.fn()
};
// Default: invoke the callback once (the admin SDK only retries on contention).
const runTransaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

vi.mock("../src/shared/firestore.js", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => "server-timestamp")
  },
  db: {
    doc: vi.fn(() => usageRef),
    runTransaction
  },
  paths: {
    visionUsage: (householdId: string) => `households/${householdId}/settings/visionUsage`
  }
}));

const { consumeVisionQuota } = await import("../src/shared/rateLimit.js");

describe("consumeVisionQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  });

  afterEach(() => {
    delete process.env.VISION_DAILY_LIMIT;
  });

  it("increments usage under the limit", async () => {
    tx.get.mockResolvedValue({ exists: false, get: () => undefined });
    await expect(consumeVisionQuota("h1")).resolves.toBeUndefined();
    expect(tx.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ count: 1 }));
  });

  it("throws resource-exhausted at the daily cap", async () => {
    const today = new Date().toISOString().slice(0, 10);
    tx.get.mockResolvedValue({
      exists: true,
      get: (f: string) => (f === "day" ? today : f === "count" ? 200 : undefined)
    });
    await expect(consumeVisionQuota("h1")).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("resets the counter on a new day", async () => {
    tx.get.mockResolvedValue({
      exists: true,
      get: (f: string) => (f === "day" ? "2020-01-01" : f === "count" ? 999 : undefined)
    });
    await expect(consumeVisionQuota("h1")).resolves.toBeUndefined();
    expect(tx.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ count: 1 }));
  });

  it("honors the VISION_DAILY_LIMIT env override", async () => {
    process.env.VISION_DAILY_LIMIT = "2";
    const today = new Date().toISOString().slice(0, 10);
    tx.get.mockResolvedValue({
      exists: true,
      get: (f: string) => (f === "day" ? today : f === "count" ? 2 : undefined)
    });
    await expect(consumeVisionQuota("h1")).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("falls back to the default cap when VISION_DAILY_LIMIT is non-numeric", async () => {
    // Number("abc") is NaN; without the guard, used >= NaN is always false and the cap
    // would be silently disabled. The default 200 must still enforce.
    process.env.VISION_DAILY_LIMIT = "abc";
    const today = new Date().toISOString().slice(0, 10);
    tx.get.mockResolvedValue({
      exists: true,
      get: (f: string) => (f === "day" ? today : f === "count" ? 200 : undefined)
    });
    await expect(consumeVisionQuota("h1")).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("falls back to the default cap (does not block) when VISION_DAILY_LIMIT is empty", async () => {
    // Number("") is 0; without the guard, used >= 0 blocks every scan. An empty override
    // must behave as unset and fall back to the default 200, so usage at 0 increments.
    process.env.VISION_DAILY_LIMIT = "";
    tx.get.mockResolvedValue({ exists: false, get: () => undefined });
    await expect(consumeVisionQuota("h1")).resolves.toBeUndefined();
    expect(tx.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ count: 1 }));
  });
});
