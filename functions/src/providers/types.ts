import type { HouseholdLlmConfig, VisionSuggestion } from "../shared/schemas.js";

export type VisionImageInput = {
  mimeType: string;
  bytes: Buffer;
  sourceUrl?: string;
};

export type ProviderContext = {
  apiKey: string;
  config: HouseholdLlmConfig;
  prompt: string;
  image: VisionImageInput;
};

export interface VisionProviderAdapter {
  classifyImage(context: ProviderContext): Promise<VisionSuggestion>;
  validate(context: { apiKey: string; config: HouseholdLlmConfig }): Promise<{ ok: boolean; message: string }>;
}
