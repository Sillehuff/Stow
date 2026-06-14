import { z } from "zod";

// SSRF guard for the OpenAI-compatible `baseUrl`: an admin-supplied URL is
// fetched server-side with the household's decrypted API key, so it must point
// at a public https host — never the metadata server, loopback, or a private range.
const BLOCKED_PROVIDER_HOSTS = new Set(["localhost", "metadata", "metadata.google.internal", "0.0.0.0"]);

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if ([a, b, Number(match[3]), Number(match[4])].some((part) => part > 255)) return false;
  if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  return false;
}

export function isPublicHttpsUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || BLOCKED_PROVIDER_HOSTS.has(host) || host.endsWith(".localhost")) return false;
  if (isPrivateIpv4(host)) return false;
  // IPv6 loopback / link-local (fe80::) / unique-local (fc00::/7).
  if (host === "::1" || host === "::" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return false;
  return true;
}

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
  baseUrl: z
    .string()
    .url()
    .max(500)
    .refine(isPublicHttpsUrl, "baseUrl must be an https URL pointing to a public host")
    .optional(),
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
  bbox: z.tuple([
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1)
  ]),
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
