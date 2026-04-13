import { beforeAll, describe, expect, it } from "vitest";

describe("crypto/kms local AES round-trip", () => {
  beforeAll(() => {
    process.env.LOCAL_SECRET_ENCRYPTION_KEY = "stow-kms-test-key-deterministic";
    delete process.env.KMS_KEY_NAME;
  });

  it("round-trips plaintext through local envelope", async () => {
    const { encryptSecret, decryptSecret } = await import("../src/crypto/kms.js");
    const plaintext = "sk-live-abcdef0123456789-super-secret";
    const envelope = await encryptSecret(plaintext);
    expect(envelope.startsWith("local:")).toBe(true);
    const parts = envelope.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[1]?.length).toBeGreaterThan(0);
    expect(parts[2]?.length).toBeGreaterThan(0);
    expect(parts[3]?.length).toBeGreaterThan(0);
    const recovered = await decryptSecret(envelope);
    expect(recovered).toBe(plaintext);
  });

  it("produces distinct envelopes for the same plaintext", async () => {
    const { encryptSecret } = await import("../src/crypto/kms.js");
    const a = await encryptSecret("hello");
    const b = await encryptSecret("hello");
    expect(a).not.toBe(b);
  });

  it("rejects unknown envelope formats", async () => {
    const { decryptSecret } = await import("../src/crypto/kms.js");
    await expect(decryptSecret("bogus:whatever")).rejects.toThrow(/Unknown secret envelope format/);
  });
});
