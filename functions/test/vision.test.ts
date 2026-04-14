import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HouseholdLlmConfig, VisionSuggestion } from "../src/shared/schemas.js";

// In-memory Firestore stub used by the mocked shared/firestore.js module.
const visionJobWrites: Array<{ path: string; data: Record<string, unknown> }> = [];
const quotaStore = new Map<string, { count: number }>();
const storageFileCalls: Array<{ path: string }> = [];
let storageFileExists = true;

const fakePaths = {
  household: (h: string) => `households/${h}`,
  member: (h: string, u: string) => `households/${h}/members/${u}`,
  members: (h: string) => `households/${h}/members`,
  invite: (h: string, i: string) => `households/${h}/invites/${i}`,
  invites: (h: string) => `households/${h}/invites`,
  llmConfig: (h: string) => `households/${h}/settings/llm`,
  llmSecret: (h: string) => `households/${h}/settings/llmSecret`,
  visionJobs: (h: string) => `households/${h}/visionJobs`,
  visionQuota: (h: string, u: string, day: string) => `households/${h}/visionQuota/${u}_${day}`,
  user: (u: string) => `users/${u}`
};

const docFactory = (path: string) => ({
  path,
  async set(data: Record<string, unknown>) {
    visionJobWrites.push({ path, data });
  }
});

type QuotaRef = { path: string };

function quotaDocRef(path: string): QuotaRef {
  return { path };
}

const fakeDb = {
  collection: (path: string) => ({
    doc: () => docFactory(`${path}/test-job-id`)
  }),
  doc: (path: string) => quotaDocRef(path),
  async runTransaction<T>(work: (tx: {
    get: (ref: QuotaRef) => Promise<{
      exists: boolean;
      get: (field: string) => unknown;
    }>;
    set: (ref: QuotaRef, data: Record<string, unknown>) => void;
  }) => Promise<T>): Promise<T> {
    return work({
      async get(ref: QuotaRef) {
        const existing = quotaStore.get(ref.path);
        return {
          exists: !!existing,
          get: (field: string) => (existing ? (existing as unknown as Record<string, unknown>)[field] : undefined)
        };
      },
      set(ref: QuotaRef, data: Record<string, unknown>) {
        const count = typeof data.count === "number" ? data.count : 0;
        quotaStore.set(ref.path, { count });
      }
    });
  }
};

const fakeStorage = {
  bucket: () => ({
    file: (p: string) => {
      storageFileCalls.push({ path: p });
      return {
        async exists() {
          return [storageFileExists];
        },
        async getSignedUrl() {
          return [`https://signed.test/${encodeURIComponent(p)}`];
        }
      };
    }
  })
};

vi.mock("../src/shared/firestore.js", () => ({
  db: fakeDb,
  storage: fakeStorage,
  auth: {},
  FieldValue: { serverTimestamp: () => "__SERVER_TS__" },
  paths: fakePaths
}));

vi.mock("../src/shared/authz.js", () => ({
  requireHouseholdMember: vi.fn(async () => "MEMBER"),
  requireHouseholdAdmin: vi.fn(async () => "ADMIN"),
  getMembershipRole: vi.fn(async () => "MEMBER"),
  requireUid: vi.fn((r: { auth?: { uid?: string } }) => r.auth?.uid ?? "")
}));

const baseConfig: HouseholdLlmConfig = {
  enabled: true,
  providerType: "openai_compatible",
  model: "gpt-4o-mini",
  baseUrl: "https://api.openai.test/v1",
  promptProfile: "default_inventory",
  temperature: 0.2,
  maxTokens: 300
};

const loadConfigMock = vi.fn<
  (householdId: string) => Promise<{ config: HouseholdLlmConfig; apiKey: string }>
>();

vi.mock("../src/llmConfig.js", () => ({
  loadConfigAndSecret: (householdId: string) => loadConfigMock(householdId),
  saveHouseholdLlmConfigHandler: vi.fn(),
  setHouseholdLlmSecretHandler: vi.fn(),
  validateHouseholdLlmConfigHandler: vi.fn()
}));

const fakeSuggestion: VisionSuggestion = {
  suggestedName: "Desk Lamp",
  tags: ["Office", "Lighting"],
  confidence: 0.91,
  rationale: "Visible arm and bulb"
};

// ---- helpers ---------------------------------------------------------------

function imageResponse(bytes: Buffer, mimeType = "image/jpeg") {
  const ab = new ArrayBuffer(bytes.length);
  new Uint8Array(ab).set(bytes);
  return new Response(ab, {
    status: 200,
    headers: { "content-type": mimeType }
  });
}

function providerJson(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function openaiResponse(suggestion: VisionSuggestion) {
  return providerJson({
    choices: [{ message: { content: JSON.stringify(suggestion) } }]
  });
}

function geminiResponse(suggestion: VisionSuggestion) {
  return providerJson({
    candidates: [{ content: { parts: [{ text: JSON.stringify(suggestion) }] } }]
  });
}

function anthropicResponse(suggestion: VisionSuggestion) {
  return providerJson({
    content: [{ type: "text", text: JSON.stringify(suggestion) }]
  });
}

// ---- tests -----------------------------------------------------------------

describe("visionCategorizeItemImageHandler", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    visionJobWrites.length = 0;
    quotaStore.clear();
    storageFileCalls.length = 0;
    storageFileExists = true;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    loadConfigMock.mockReset();
    delete process.env.VISION_DAILY_PER_USER_LIMIT;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs the full happy path via OpenAI-compatible and logs a vision job", async () => {
    loadConfigMock.mockResolvedValue({ config: baseConfig, apiKey: "sk-test" });
    fetchMock
      .mockResolvedValueOnce(imageResponse(Buffer.from("fake-image"), "image/jpeg"))
      .mockResolvedValueOnce(openaiResponse(fakeSuggestion));

    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");
    const result = await visionCategorizeItemImageHandler(
      {
        householdId: "h1",
        imageRef: { imageUrl: "https://example.test/item.jpg" }
      },
      "uid-1"
    );

    expect(result.suggestion.suggestedName).toBe("Desk Lamp");
    expect(result.provider.providerType).toBe("openai_compatible");
    expect(visionJobWrites).toHaveLength(1);
    expect(visionJobWrites[0]?.data).toMatchObject({
      providerType: "openai_compatible",
      model: "gpt-4o-mini",
      confidence: 0.91,
      createdBy: "uid-1"
    });
    // Second fetch is the provider call
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.openai.test/v1/chat/completions");
  });

  it("works against the Gemini provider", async () => {
    loadConfigMock.mockResolvedValue({
      config: { ...baseConfig, providerType: "gemini", model: "gemini-1.5-flash", baseUrl: undefined },
      apiKey: "AIza-test"
    });
    fetchMock
      .mockResolvedValueOnce(imageResponse(Buffer.from("png-bytes"), "image/png"))
      .mockResolvedValueOnce(geminiResponse(fakeSuggestion));

    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");
    const result = await visionCategorizeItemImageHandler(
      {
        householdId: "h1",
        imageRef: { imageUrl: "https://example.test/item.png" }
      },
      "uid-2"
    );
    expect(result.provider.providerType).toBe("gemini");
    expect(result.suggestion.suggestedName).toBe("Desk Lamp");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("generateContent");
  });

  it("works against the Anthropic provider", async () => {
    loadConfigMock.mockResolvedValue({
      config: { ...baseConfig, providerType: "anthropic", model: "claude-3-5-sonnet-20241022", baseUrl: undefined },
      apiKey: "sk-ant-test"
    });
    fetchMock
      .mockResolvedValueOnce(imageResponse(Buffer.from("jpg-bytes"), "image/jpeg"))
      .mockResolvedValueOnce(anthropicResponse(fakeSuggestion));

    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");
    const result = await visionCategorizeItemImageHandler(
      {
        householdId: "h1",
        imageRef: { imageUrl: "https://example.test/item.jpg" }
      },
      "uid-3"
    );
    expect(result.provider.providerType).toBe("anthropic");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.anthropic.com/v1/messages");
  });

  it("rejects when the feature is disabled", async () => {
    loadConfigMock.mockResolvedValue({
      config: { ...baseConfig, enabled: false },
      apiKey: "sk-test"
    });
    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");
    await expect(
      visionCategorizeItemImageHandler(
        { householdId: "h1", imageRef: { imageUrl: "https://example.test/item.jpg" } },
        "uid-1"
      )
    ).rejects.toThrow(/disabled/);
    expect(visionJobWrites).toHaveLength(0);
  });

  it("rejects oversized images", async () => {
    loadConfigMock.mockResolvedValue({ config: baseConfig, apiKey: "sk-test" });
    const { MAX_IMAGE_BYTES } = await import("../src/vision.js");
    const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1, 0x41);
    fetchMock.mockResolvedValueOnce(imageResponse(oversized, "image/jpeg"));

    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");
    await expect(
      visionCategorizeItemImageHandler(
        { householdId: "h1", imageRef: { imageUrl: "https://example.test/huge.jpg" } },
        "uid-1"
      )
    ).rejects.toThrow(/maximum size/);
    expect(visionJobWrites).toHaveLength(0);
  });

  it("rejects non-image MIME types", async () => {
    loadConfigMock.mockResolvedValue({ config: baseConfig, apiKey: "sk-test" });
    fetchMock.mockResolvedValueOnce(imageResponse(Buffer.from("<html/>"), "text/html"));

    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");
    await expect(
      visionCategorizeItemImageHandler(
        { householdId: "h1", imageRef: { imageUrl: "https://example.test/page.html" } },
        "uid-1"
      )
    ).rejects.toThrow(/Unsupported image MIME/);
  });

  it("resolves images via the storagePath branch (signed URL) and routes through the provider", async () => {
    loadConfigMock.mockResolvedValue({ config: baseConfig, apiKey: "sk-test" });
    fetchMock
      .mockResolvedValueOnce(imageResponse(Buffer.from("signed-bytes"), "image/jpeg"))
      .mockResolvedValueOnce(openaiResponse(fakeSuggestion));

    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");
    const result = await visionCategorizeItemImageHandler(
      {
        householdId: "h1",
        imageRef: { storagePath: "drafts/h1/uid-1/capture.jpg" }
      },
      "uid-1"
    );

    expect(result.suggestion.suggestedName).toBe("Desk Lamp");
    expect(storageFileCalls).toEqual([{ path: "drafts/h1/uid-1/capture.jpg" }]);
    // First fetch must target the signed URL returned by the mocked bucket.
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://signed.test/drafts%2Fh1%2Fuid-1%2Fcapture.jpg"
    );
    expect(visionJobWrites).toHaveLength(1);
  });

  it("rejects a storagePath that does not exist in storage", async () => {
    loadConfigMock.mockResolvedValue({ config: baseConfig, apiKey: "sk-test" });
    storageFileExists = false;

    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");
    await expect(
      visionCategorizeItemImageHandler(
        { householdId: "h1", imageRef: { storagePath: "drafts/h1/uid-1/missing.jpg" } },
        "uid-1"
      )
    ).rejects.toThrow(/not found in storage/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(visionJobWrites).toHaveLength(0);
  });

  it("pre-rejects images when Content-Length exceeds the limit (without buffering)", async () => {
    loadConfigMock.mockResolvedValue({ config: baseConfig, apiKey: "sk-test" });
    const { MAX_IMAGE_BYTES } = await import("../src/vision.js");
    // Hand back a tiny body but advertise a massive Content-Length. If the
    // handler were to buffer first, this test would be slow; instead it
    // should read the header and bail immediately.
    const oversizedHeader = new Response("x", {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "content-length": String(MAX_IMAGE_BYTES + 1)
      }
    });
    fetchMock.mockResolvedValueOnce(oversizedHeader);

    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");
    await expect(
      visionCategorizeItemImageHandler(
        { householdId: "h1", imageRef: { imageUrl: "https://example.test/huge.jpg" } },
        "uid-1"
      )
    ).rejects.toThrow(/maximum size/);
    expect(visionJobWrites).toHaveLength(0);
  });

  it("caps body size even when Content-Length is missing", async () => {
    loadConfigMock.mockResolvedValue({ config: baseConfig, apiKey: "sk-test" });
    const { MAX_IMAGE_BYTES } = await import("../src/vision.js");
    // Stream a body larger than the limit with no Content-Length header. The
    // streaming reader should cancel once the byte count crosses MAX_IMAGE_BYTES.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const chunkSize = 1024 * 1024; // 1 MB chunks
        const totalChunks = Math.ceil(MAX_IMAGE_BYTES / chunkSize) + 2;
        const chunk = new Uint8Array(chunkSize).fill(0x41);
        for (let i = 0; i < totalChunks; i++) controller.enqueue(chunk);
        controller.close();
      }
    });
    const streamResponse = new Response(stream, {
      status: 200,
      headers: { "content-type": "image/jpeg" }
    });
    fetchMock.mockResolvedValueOnce(streamResponse);

    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");
    await expect(
      visionCategorizeItemImageHandler(
        { householdId: "h1", imageRef: { imageUrl: "https://example.test/stream.jpg" } },
        "uid-1"
      )
    ).rejects.toThrow(/maximum size/);
  });

  it("enforces the per-user daily quota", async () => {
    process.env.VISION_DAILY_PER_USER_LIMIT = "2";
    loadConfigMock.mockResolvedValue({ config: baseConfig, apiKey: "sk-test" });
    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");

    for (let i = 0; i < 2; i++) {
      fetchMock
        .mockResolvedValueOnce(imageResponse(Buffer.from(`img-${i}`), "image/jpeg"))
        .mockResolvedValueOnce(openaiResponse(fakeSuggestion));
      const result = await visionCategorizeItemImageHandler(
        { householdId: "h1", imageRef: { imageUrl: `https://example.test/${i}.jpg` } },
        "uid-1"
      );
      expect(result.quota).toEqual({ count: i + 1, limit: 2 });
    }

    // Third call should be rejected BEFORE the provider or image fetch runs.
    fetchMock.mockClear();
    await expect(
      visionCategorizeItemImageHandler(
        { householdId: "h1", imageRef: { imageUrl: "https://example.test/3.jpg" } },
        "uid-1"
      )
    ).rejects.toThrow(/daily limit reached/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(visionJobWrites).toHaveLength(2);
  });

  it("tracks quota independently per user", async () => {
    process.env.VISION_DAILY_PER_USER_LIMIT = "1";
    loadConfigMock.mockResolvedValue({ config: baseConfig, apiKey: "sk-test" });
    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");

    fetchMock
      .mockResolvedValueOnce(imageResponse(Buffer.from("a"), "image/jpeg"))
      .mockResolvedValueOnce(openaiResponse(fakeSuggestion))
      .mockResolvedValueOnce(imageResponse(Buffer.from("b"), "image/jpeg"))
      .mockResolvedValueOnce(openaiResponse(fakeSuggestion));

    await visionCategorizeItemImageHandler(
      { householdId: "h1", imageRef: { imageUrl: "https://example.test/a.jpg" } },
      "user-A"
    );
    // user-B should still have their quota intact.
    await expect(
      visionCategorizeItemImageHandler(
        { householdId: "h1", imageRef: { imageUrl: "https://example.test/b.jpg" } },
        "user-B"
      )
    ).resolves.toBeDefined();
    expect(visionJobWrites).toHaveLength(2);
  });

  it("surfaces provider errors to the caller", async () => {
    loadConfigMock.mockResolvedValue({ config: baseConfig, apiKey: "sk-test" });
    fetchMock
      .mockResolvedValueOnce(imageResponse(Buffer.from("img"), "image/jpeg"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "rate_limited" } }), { status: 429 })
      );

    const { visionCategorizeItemImageHandler } = await import("../src/vision.js");
    await expect(
      visionCategorizeItemImageHandler(
        { householdId: "h1", imageRef: { imageUrl: "https://example.test/item.jpg" } },
        "uid-1"
      )
    ).rejects.toThrow(/OpenAI-compatible API request failed \(429\).*rate_limited/);
  });
});
