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
  lastValidatedAt: z
    .union([
      z.date(),
      z
        .object({
          seconds: z.number().int(),
          nanoseconds: z.number().int().min(0)
        })
        .passthrough(),
      z
        .object({
          _seconds: z.number().int(),
          _nanoseconds: z.number().int().min(0)
        })
        .passthrough()
    ])
    .optional(),
  lastValidatedBy: z.string().optional()
});
export type HouseholdLlmConfig = z.infer<typeof llmConfigSchema>;

export const createInviteInputSchema = z.object({
  householdId: z.string().min(1),
  role: roleSchema.refine((r) => r !== "OWNER", "Owner invites are not supported via link"),
  expiresInHours: z.number().int().min(1).max(24 * 14).optional(),
  email: z.string().email().max(320).optional()
});

export const acceptInviteInputSchema = z.object({
  householdId: z.string().min(1),
  token: z.string().min(20)
});

export const revokeInviteInputSchema = z.object({
  householdId: z.string().min(1),
  inviteId: z.string().min(1)
});

export const updateMemberRoleInputSchema = z.object({
  householdId: z.string().min(1),
  uid: z.string().min(1),
  role: roleSchema
});

export const removeMemberInputSchema = z.object({
  householdId: z.string().min(1),
  uid: z.string().min(1)
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

export const visionImageRefSchema = z.object({
  storagePath: z.string().min(1)
});

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

export const visionDetectShelfInputSchema = z.object({
  householdId: z.string().min(1),
  imageRef: visionImageRefSchema,
  spaceId: z.string().optional(),
  areaId: z.string().optional(),
  areaName: z.string().optional()
});
export type VisionDetectShelfInput = z.infer<typeof visionDetectShelfInputSchema>;

export const shelfDetectionSchema = z.object({
  label: z.string().min(1),
  confidence: z.number().min(0).max(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  suggestedValue: z.number().nonnegative().optional(),
  tags: z.array(z.string().min(1)).max(15).optional()
});
export type ShelfDetection = z.infer<typeof shelfDetectionSchema>;

export const visionDetectShelfResultSchema = z.object({
  detections: z.array(shelfDetectionSchema),
  provider: z.string().min(1),
  jobId: z.string().min(1)
});
export type VisionDetectShelfResult = z.infer<typeof visionDetectShelfResultSchema>;
