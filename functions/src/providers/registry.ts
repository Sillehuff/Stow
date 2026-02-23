import { HttpsError } from "firebase-functions/v2/https";
import type { ProviderType } from "../shared/schemas.js";
import type { VisionProviderAdapter } from "./types.js";
import { openaiCompatibleAdapter } from "./openaiCompatible.js";
import { geminiAdapter } from "./gemini.js";
import { anthropicAdapter } from "./anthropic.js";

const registry: Record<ProviderType, VisionProviderAdapter> = {
  openai_compatible: openaiCompatibleAdapter,
  gemini: geminiAdapter,
  anthropic: anthropicAdapter
};

export function getVisionAdapter(providerType: ProviderType): VisionProviderAdapter {
  const adapter = registry[providerType];
  if (!adapter) throw new HttpsError("failed-precondition", `Unsupported provider type: ${providerType}`);
  return adapter;
}
