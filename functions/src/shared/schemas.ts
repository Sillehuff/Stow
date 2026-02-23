import { z } from "zod";

export const roleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export type Role = z.infer<typeof roleSchema>;

export const providerTypeSchema = z.enum(["openai_compatible", "gemini", "anthropic"]);
export type ProviderType = z.infer<typeof providerTypeSchema>;

export const llmConfigSchema = z.object({
  enabled: z.boolean(),
  providerType: providerTypeSchema,
  model: z.string().min(1),
  baseUrl: z.string().url().optional(),
  promptProfile: z.literal("default_inventory"),
  maxTokens: z.number().int().positive().max(4096).optional(),
  temperature: z.number().min(0).max(2).optional(),
  lastValidatedAt: z.any().optional(),
  lastValidatedBy: z.string().optional()
});
export type HouseholdLlmConfig = z.infer<typeof llmConfigSchema>;

export const createInviteInputSchema = z.object({
  householdId: z.string().min(1),
  role: roleSchema.refine((r) => r !== "OWNER", "Owner invites are not supported via link"),
  expiresInHours: z.number().int().min(1).max(24 * 14).optional()
});

export const acceptInviteInputSchema = z.object({
  householdId: z.string().min(1),
  token: z.string().min(20)
});

export const saveLlmConfigInputSchema = z.object({
  householdId: z.string().min(1),
  config: llmConfigSchema
});

export const setLlmSecretInputSchema = z.object({
  householdId: z.string().min(1),
  apiKey: z.string().min(8)
});

export const validateLlmConfigInputSchema = z.object({
  householdId: z.string().min(1)
});

export const visionImageRefSchema = z.union([
  z.object({
    storagePath: z.string().min(1),
    downloadUrl: z.string().url().optional()
  }),
  z.object({
    imageUrl: z.string().url()
  })
]);

export const visionCategorizeInputSchema = z.object({
  householdId: z.string().min(1),
  imageRef: visionImageRefSchema,
  context: z
    .object({
      spaceId: z.string().optional(),
      areaId: z.string().optional(),
      areaName: z.string().optional()
    })
    .optional()
});

export const visionSuggestionSchema = z.object({
  suggestedName: z.string().min(1),
  tags: z.array(z.string().min(1)).max(15),
  notes: z.string().optional(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional()
});
export type VisionSuggestion = z.infer<typeof visionSuggestionSchema>;
