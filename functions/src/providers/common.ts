import { HttpsError } from "firebase-functions/v2/https";
import { visionSuggestionSchema, type VisionSuggestion } from "../shared/schemas.js";

const PROVIDER_TIMEOUT_MS = 30_000;

/** fetch with a hard timeout — a hung provider must not pin the function until the platform kills it. */
export async function providerFetch(
  url: string,
  init: RequestInit,
  timeoutMs = PROVIDER_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // redirect: "error" prevents a provider host from redirecting the request
    // (and the Bearer key) to an internal address — SSRF defense-in-depth.
    return await fetch(url, { redirect: "error", ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new HttpsError("deadline-exceeded", "AI provider request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

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
