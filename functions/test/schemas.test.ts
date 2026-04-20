import { describe, expect, it } from "vitest";
import {
  createInviteInputSchema,
  deleteAreaInputSchema,
  deleteItemInputSchema,
  deleteSpaceInputSchema,
  llmConfigSchema,
  revokeInviteInputSchema,
  visionCategorizeInputSchema,
  visionSuggestionSchema
} from "../src/shared/schemas.js";

describe("shared schemas", () => {
  it("validates invite payloads", () => {
    expect(() =>
      createInviteInputSchema.parse({ householdId: "h1", role: "MEMBER", expiresInHours: 72 })
    ).not.toThrow();
    expect(() =>
      createInviteInputSchema.parse({ householdId: "h1", role: "ADMIN", replaceInviteId: "invite-1" })
    ).not.toThrow();
    expect(() =>
      revokeInviteInputSchema.parse({ householdId: "h1", inviteId: "invite-1" })
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

  it("validates delete payloads", () => {
    expect(() =>
      deleteAreaInputSchema.parse({
        householdId: "h1",
        spaceId: "space-1",
        areaId: "area-1",
        reassignTo: { spaceId: "space-2", areaId: "area-9" }
      })
    ).not.toThrow();
    expect(() =>
      deleteSpaceInputSchema.parse({
        householdId: "h1",
        spaceId: "space-1",
        reassignTo: { spaceId: "space-2", areaId: "area-9" }
      })
    ).not.toThrow();
    expect(() =>
      deleteItemInputSchema.parse({
        householdId: "h1",
        itemId: "item-1"
      })
    ).not.toThrow();
  });

  it("validates vision requests", () => {
    expect(() =>
      visionCategorizeInputSchema.parse({
        householdId: "h1",
        imageRef: { storagePath: "households/h1/drafts/draft-1/images/image.jpg" },
        context: { areaName: "Desk" }
      })
    ).not.toThrow();
    expect(() =>
      visionCategorizeInputSchema.parse({
        householdId: "h1",
        imageRef: { imageUrl: "https://example.com/image.jpg" },
        context: { areaName: "Desk" }
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
});
