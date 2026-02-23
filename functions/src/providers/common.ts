import { HttpsError } from "firebase-functions/v2/https";
import { visionSuggestionSchema, type VisionSuggestion } from "../shared/schemas.js";

export function inventoryVisionPrompt(extraContext?: { areaName?: string }) {
  return [
    "You categorize household inventory items from a single image.",
    "Return STRICT JSON with keys: suggestedName, tags, notes, confidence, rationale.",
    "Confidence must be between 0 and 1.",
    "Avoid guessing exact brand/model unless clearly visible.",
    "Tags should be short and useful (2-6 typical).",
    extraContext?.areaName ? `The item may be located in area: ${extraContext.areaName}.` : "",
    "If uncertain, use a generic name and lower confidence."
  ]
    .filter(Boolean)
    .join(" ");
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try extracting first JSON object block.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new HttpsError("internal", "Provider response was not valid JSON");
  }
}

export function normalizeSuggestion(candidate: unknown): VisionSuggestion {
  const parsed = visionSuggestionSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new HttpsError("internal", `Invalid vision suggestion payload: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }
  return parsed.data;
}

export function requireOk(response: Response, provider: string) {
  if (!response.ok) {
    throw new HttpsError(
      "internal",
      `${provider} API request failed (${response.status}): ${response.statusText}`
    );
  }
}
