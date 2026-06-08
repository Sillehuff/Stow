import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

const requireHouseholdMember = vi.fn();
const loadConfigAndSecret = vi.fn();
const classifyImage = vi.fn();

const fileExists = vi.fn();
const fileGetMetadata = vi.fn();
const fileCreateReadStream = vi.fn();
const visionJobSet = vi.fn();

vi.mock("../src/shared/authz.js", () => ({
  requireHouseholdMember
}));

vi.mock("../src/llmConfig.js", () => ({
  loadConfigAndSecret
}));

vi.mock("../src/providers/registry.js", () => ({
  getVisionAdapter: vi.fn(() => ({
    classifyImage
  }))
}));

vi.mock("../src/shared/firestore.js", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => "server-timestamp")
  },
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        id: "vision-job-1",
        set: visionJobSet
      }))
    }))
  },
  paths: {
    visionJobs: (householdId: string) => `households/${householdId}/visionJobs`
  },
  storage: {
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        exists: fileExists,
        getMetadata: fileGetMetadata,
        createReadStream: fileCreateReadStream
      }))
    }))
  }
}));

const { visionCategorizeItemImageHandler } = await import("../src/vision.js");

describe("vision categorization input guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireHouseholdMember.mockResolvedValue("MEMBER");
    loadConfigAndSecret.mockResolvedValue({
      config: {
        enabled: true,
        providerType: "openai_compatible",
        model: "gpt-4.1-mini"
      },
      apiKey: "test-key"
    });
    classifyImage.mockResolvedValue({
      suggestedName: "Camera",
      tags: ["Tech"],
      confidence: 0.8
    });
    fileExists.mockResolvedValue([true]);
  });

  it("rejects storage paths outside the household bucket prefix", async () => {
    await expect(
      visionCategorizeItemImageHandler(
        {
          householdId: "h1",
          imageRef: { storagePath: "https://example.com/image.png" }
        },
        "user-1"
      )
    ).rejects.toMatchObject<HttpsError>({
      code: "permission-denied"
    });
    expect(classifyImage).not.toHaveBeenCalled();
  });

  it("rejects non-image uploads before provider calls", async () => {
    fileGetMetadata.mockResolvedValue([{ contentType: "application/pdf", size: "1024" }]);

    await expect(
      visionCategorizeItemImageHandler(
        {
          householdId: "h1",
          imageRef: { storagePath: "households/h1/items/item-1/file.bin" }
        },
        "user-1"
      )
    ).rejects.toMatchObject<HttpsError>({
      code: "invalid-argument"
    });
    expect(classifyImage).not.toHaveBeenCalled();
  });

  it("rejects images larger than 10 MB before provider calls", async () => {
    fileGetMetadata.mockResolvedValue([{ contentType: "image/png", size: String(10 * 1024 * 1024 + 1) }]);

    await expect(
      visionCategorizeItemImageHandler(
        {
          householdId: "h1",
          imageRef: { storagePath: "households/h1/items/item-1/file.png" }
        },
        "user-1"
      )
    ).rejects.toMatchObject<HttpsError>({
      code: "invalid-argument"
    });
    expect(classifyImage).not.toHaveBeenCalled();
  });
});
