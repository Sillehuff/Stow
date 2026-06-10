import { z } from "zod";

// Bounded primitives for callable inputs. Without an upper bound, a client can
// send a multi-megabyte string that flows into Firestore paths or provider
// prompts (cost amplification). `.strict()` on input objects (below) rejects
// unknown fields instead of silently dropping them.
const idString = z.string().min(1).max(128);
const shortString = z.string().max(300);

export const roleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export type Role = z.infer<typeof roleSchema>;

export const providerTypeSchema = z.enum(["openai_compatible", "gemini", "anthropic"]);
export type ProviderType = z.infer<typeof providerTypeSchema>;

export const llmConfigSchema = z.object({
  enabled: z.boolean(),
  providerType: providerTypeSchema,
  model: z.string().min(1).max(200),
  baseUrl: z.string().url().max(500).optional(),
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

export const createInviteInputSchema = z
  .object({
    householdId: idString,
    role: roleSchema.refine((r) => r !== "OWNER", "Owner invites are not supported via link"),
    expiresInHours: z.number().int().min(1).max(24 * 14).optional(),
    email: z.string().email().max(320).optional()
  })
  .strict();

export const acceptInviteInputSchema = z
  .object({
    householdId: idString,
    token: z.string().min(20).max(256)
  })
  .strict();

export const revokeInviteInputSchema = z
  .object({
    householdId: idString,
    inviteId: idString
  })
  .strict();

export const updateMemberRoleInputSchema = z
  .object({
    householdId: idString,
    uid: idString,
    role: roleSchema
  })
  .strict();

export const removeMemberInputSchema = z
  .object({
    householdId: idString,
    uid: idString
  })
  .strict();

export const saveLlmConfigInputSchema = z
  .object({
    householdId: idString,
    // Validation/audit state is written only by validateHouseholdLlmConfigHandler.
    // .strict() turns a client-forged lastValidatedAt/lastValidatedBy into a parse
    // error instead of silently stripping it.
    config: llmConfigSchema.omit({ lastValidatedAt: true, lastValidatedBy: true }).strict()
  })
  .strict();

export const setLlmSecretInputSchema = z
  .object({
    householdId: idString,
    apiKey: z.string().min(8).max(500)
  })
  .strict();

export const validateLlmConfigInputSchema = z
  .object({
    householdId: idString
  })
  .strict();

export const visionImageRefSchema = z
  .object({
    storagePath: z.string().min(1).max(1024)
  })
  .strict();

export const visionCategorizeInputSchema = z
  .object({
    householdId: idString,
    imageRef: visionImageRefSchema,
    context: z
      .object({
        spaceId: idString.optional(),
        areaId: idString.optional(),
        areaName: shortString.optional()
      })
      .strict()
      .optional()
  })
  .strict();

export const visionSuggestionSchema = z.object({
  suggestedName: z.string().min(1),
  tags: z.array(z.string().min(1)).max(15),
  notes: z.string().optional(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional()
});
export type VisionSuggestion = z.infer<typeof visionSuggestionSchema>;

export const visionDetectShelfInputSchema = z
  .object({
    householdId: idString,
    imageRef: visionImageRefSchema,
    spaceId: idString.optional(),
    areaId: idString.optional(),
    areaName: shortString.optional()
  })
  .strict();
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
