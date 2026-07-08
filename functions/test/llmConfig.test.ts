import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HouseholdLlmConfig } from "../src/shared/schemas.js";

const requireHouseholdAdmin = vi.fn();
const decryptSecret = vi.fn();
const encryptSecret = vi.fn();
const validate = vi.fn();
const getVisionAdapter = vi.fn();
const llmConfigSet = vi.fn();
const llmSecretSet = vi.fn();
const llmConfigGet = vi.fn();
const llmSecretGet = vi.fn();
const fieldValueDelete = vi.fn(() => "field-delete");
const serverTimestamp = vi.fn(() => "server-timestamp");

const llmConfigRef = {
  get: llmConfigGet,
  set: llmConfigSet
};
const llmSecretRef = {
  get: llmSecretGet,
  set: llmSecretSet
};

vi.mock("../src/shared/authz.js", () => ({
  requireHouseholdAdmin
}));

vi.mock("../src/crypto/kms.js", () => ({
  decryptSecret,
  encryptSecret
}));

vi.mock("../src/providers/registry.js", () => ({
  getVisionAdapter
}));

vi.mock("../src/shared/firestore.js", () => ({
  FieldValue: {
    delete: fieldValueDelete,
    serverTimestamp
  },
  db: {
    doc: vi.fn((path: string) => (path.endsWith("/settings/llmSecret") ? llmSecretRef : llmConfigRef))
  },
  paths: {
    llmConfig: (householdId: string) => `households/${householdId}/settings/llm`,
    llmSecret: (householdId: string) => `households/${householdId}/settings/llmSecret`
  }
}));

const {
  loadConfigAndSecret,
  saveHouseholdLlmConfigHandler,
  validateHouseholdLlmConfigHandler
} = await import("../src/llmConfig.js");

function docSnap(data: Record<string, unknown>) {
  return {
    exists: true,
    data: () => data,
    get: (field: string) => data[field]
  };
}

const geminiConfig = (model: string): HouseholdLlmConfig => ({
  enabled: true,
  providerType: "gemini",
  model,
  promptProfile: "default_inventory"
});

describe("llm config handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireHouseholdAdmin.mockResolvedValue("ADMIN");
    decryptSecret.mockImplementation(async (ciphertext: string) => `plain:${ciphertext}`);
    encryptSecret.mockResolvedValue("encrypted-key");
    validate.mockResolvedValue({ ok: true, message: "Connection successful" });
    getVisionAdapter.mockReturnValue({ validate });
    llmConfigSet.mockResolvedValue(undefined);
    llmSecretSet.mockResolvedValue(undefined);
    llmConfigGet.mockResolvedValue(docSnap(geminiConfig("gemini-default")));
    llmSecretGet.mockResolvedValue(docSnap({ ciphertext: "cipher-default" }));
  });

  it("writes a delete sentinel when saving a cleared baseUrl", async () => {
    await saveHouseholdLlmConfigHandler(
      {
        householdId: "h-save-clear",
        config: {
          enabled: true,
          providerType: "gemini",
          model: "gemini-2.5-flash",
          baseUrl: null,
          promptProfile: "default_inventory"
        }
      },
      "admin-1"
    );

    expect(requireHouseholdAdmin).toHaveBeenCalledWith("h-save-clear", "admin-1");
    expect(fieldValueDelete).toHaveBeenCalledTimes(1);
    expect(llmConfigSet).toHaveBeenCalledWith(
      expect.objectContaining({
        providerType: "gemini",
        model: "gemini-2.5-flash",
        baseUrl: "field-delete",
        updatedAt: "server-timestamp",
        updatedBy: "admin-1"
      }),
      { merge: true }
    );
  });

  it("rejects openai_compatible saves without a baseUrl", async () => {
    await expect(
      saveHouseholdLlmConfigHandler(
        {
          householdId: "h-openai",
          config: {
            enabled: true,
            providerType: "openai_compatible",
            model: "gpt-4.1-mini",
            promptProfile: "default_inventory"
          }
        },
        "admin-1"
      )
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(llmConfigSet).not.toHaveBeenCalled();
  });

  it("invalidates the local config cache before validating", async () => {
    const oldConfig = geminiConfig("gemini-old");
    const newConfig = geminiConfig("gemini-new");
    llmConfigGet.mockResolvedValueOnce(docSnap(oldConfig)).mockResolvedValueOnce(docSnap(newConfig));
    llmSecretGet
      .mockResolvedValueOnce(docSnap({ ciphertext: "cipher-old" }))
      .mockResolvedValueOnce(docSnap({ ciphertext: "cipher-new" }));

    await expect(loadConfigAndSecret("h-validate")).resolves.toEqual({
      config: oldConfig,
      apiKey: "plain:cipher-old"
    });

    await validateHouseholdLlmConfigHandler({ householdId: "h-validate" }, "admin-1");

    expect(llmConfigGet).toHaveBeenCalledTimes(2);
    expect(llmSecretGet).toHaveBeenCalledTimes(2);
    expect(validate).toHaveBeenCalledWith({
      config: newConfig,
      apiKey: "plain:cipher-new"
    });
  });
});
