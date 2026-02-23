import { describe, expect, it } from "vitest";
import {
  createInviteInputSchema,
  llmConfigSchema,
  visionCategorizeInputSchema,
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

  it("validates vision requests", () => {
    expect(() =>
      visionCategorizeInputSchema.parse({
        householdId: "h1",
        imageRef: { imageUrl: "https://example.com/image.jpg" },
        context: { areaName: "Desk" }
      })
    ).not.toThrow();
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
});
