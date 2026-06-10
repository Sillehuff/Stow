import { describe, expect, it } from "vitest";
import {
  createInviteInputSchema,
  llmConfigSchema,
  saveLlmConfigInputSchema,
  shelfDetectionSchema,
  visionCategorizeInputSchema,
  visionDetectShelfInputSchema,
  visionDetectShelfResultSchema,
  visionSuggestionSchema
} from "../src/shared/schemas.js";

describe("shared schemas", () => {
  it("validates invite payloads", () => {
    expect(() =>
      createInviteInputSchema.parse({ householdId: "h1", role: "MEMBER", expiresInHours: 72 })
    ).not.toThrow();
    expect(() => createInviteInputSchema.parse({ householdId: "h1", role: "OWNER" })).toThrow();
  });

  it("validates llm config", () => {
    expect(() =>
      llmConfigSchema.parse({
        enabled: true,
        providerType: "openai_compatible",
        model: "gpt-4.1-mini",
        baseUrl: "https://api.openai.com/v1",
        promptProfile: "default_inventory",
        temperature: 0.2,
        maxTokens: 300
      })
    ).not.toThrow();
  });

  it("accepts a save-config input without validation/audit fields", () => {
    const result = saveLlmConfigInputSchema.safeParse({
      householdId: "h1",
      config: {
        enabled: true,
        providerType: "gemini",
        model: "gemini-2.5-flash",
        promptProfile: "default_inventory"
      }
    });
    expect(result.success).toBe(true);
  });

  it("rejects client-supplied validation/audit fields in saveLlmConfig input", () => {
    const result = saveLlmConfigInputSchema.safeParse({
      householdId: "h1",
      config: {
        enabled: true,
        providerType: "gemini",
        model: "gemini-2.5-flash",
        promptProfile: "default_inventory",
        lastValidatedAt: new Date(),
        lastValidatedBy: "forged"
      }
    });
    expect(result.success).toBe(false);
  });

  it("validates vision requests", () => {
    expect(() =>
      visionCategorizeInputSchema.parse({
        householdId: "h1",
        imageRef: { storagePath: "households/h1/items/item-1/image.jpg" },
        context: { areaName: "Desk" }
      })
    ).not.toThrow();
    expect(() =>
      visionCategorizeInputSchema.parse({
        householdId: "h1",
        imageRef: { imageUrl: "https://example.com/image.jpg" }
      })
    ).toThrow();
  });

  it("validates normalized suggestions", () => {
    expect(() =>
      visionSuggestionSchema.parse({
        suggestedName: "Headphones",
        tags: ["Tech", "Audio"],
        confidence: 0.77
      })
    ).not.toThrow();
  });

  it("validates shelf-detection requests", () => {
    expect(() =>
      visionDetectShelfInputSchema.parse({
        householdId: "h1",
        imageRef: { storagePath: "households/h1/items/item-1/image.jpg" },
        spaceId: "s1",
        areaId: "a1",
        areaName: "Shelf"
      })
    ).not.toThrow();
    expect(() => visionDetectShelfInputSchema.parse({ householdId: "h1" })).toThrow();
    expect(() =>
      visionDetectShelfInputSchema.parse({ householdId: "", imageRef: { storagePath: "x" } })
    ).toThrow();
  });

  it("validates a single shelf detection", () => {
    expect(() =>
      shelfDetectionSchema.parse({
        label: "Mechanical Keyboard",
        confidence: 0.97,
        bbox: [0.11, 0.15, 0.45, 0.29],
        suggestedValue: 140,
        tags: ["Tech", "Work"]
      })
    ).not.toThrow();
    expect(() =>
      shelfDetectionSchema.parse({ label: "Box", confidence: 0.5, bbox: [0, 0, 1, 1] })
    ).not.toThrow();
    expect(() =>
      shelfDetectionSchema.parse({ label: "Box", confidence: 1.4, bbox: [0, 0, 1, 1] })
    ).toThrow();
    expect(() =>
      shelfDetectionSchema.parse({ label: "Box", confidence: 0.5, bbox: [0, 0, 1] })
    ).toThrow();
    expect(() =>
      shelfDetectionSchema.parse({ label: "", confidence: 0.5, bbox: [0, 0, 1, 1] })
    ).toThrow();
  });

  it("validates a shelf-detection result envelope", () => {
    expect(() =>
      visionDetectShelfResultSchema.parse({
        detections: [{ label: "Box", confidence: 0.5, bbox: [0, 0, 1, 1] }],
        provider: "gemini",
        jobId: "job-1"
      })
    ).not.toThrow();
    expect(() =>
      visionDetectShelfResultSchema.parse({ detections: [], provider: "gemini", jobId: "job-1" })
    ).not.toThrow();
  });
});
