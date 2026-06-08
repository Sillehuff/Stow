import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe("secret encryption configuration guard", () => {
  it("rejects the placeholder local key outside local and emulator runtimes", async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      K_SERVICE: "stow-functions",
      FUNCTIONS_EMULATOR: "false",
      FIREBASE_EMULATOR_HUB: "",
      KMS_KEY_NAME: "",
      LOCAL_SECRET_ENCRYPTION_KEY: "stow-local-dev-only-change-me"
    };

    const { encryptSecret } = await import("../src/crypto/kms.js");
    await expect(encryptSecret("top-secret")).rejects.toThrow(
      "Secret encryption is misconfigured"
    );
  });

  it("still allows local fallback encryption in test mode", async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      K_SERVICE: "",
      KMS_KEY_NAME: "",
      LOCAL_SECRET_ENCRYPTION_KEY: "stow-local-dev-only-change-me"
    };

    const { decryptSecret, encryptSecret } = await import("../src/crypto/kms.js");
    const ciphertext = await encryptSecret("top-secret");

    await expect(decryptSecret(ciphertext)).resolves.toBe("top-secret");
  });
});
