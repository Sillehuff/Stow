import type { Timestamp } from "firebase/firestore";

export type ProviderType = "openai_compatible" | "gemini" | "anthropic";

export interface HouseholdLlmConfig {
  providerType: ProviderType;
  model: string;
  baseUrl?: string;
  enabled: boolean;
  promptProfile: "default_inventory";
  maxTokens?: number;
  temperature?: number;
  lastValidatedAt?: Timestamp;
  lastValidatedBy?: string;
}

export interface VisionSuggestion {
  suggestedName: string;
  tags: string[];
  notes?: string;
  confidence: number;
  rationale?: string;
}

export interface VisionCategorizeRequest {
  householdId: string;
  imageRef:
    | { storagePath: string; downloadUrl?: string }
    | { imageUrl: string };
  context?: {
    spaceId?: string;
    areaId?: string;
    areaName?: string;
  };
}

export interface VisionCategorizeResponse {
  suggestion: VisionSuggestion;
  provider: {
    providerType: ProviderType;
    model: string;
  };
}
