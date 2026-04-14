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

/**
 * Strip substrings that may contain a secret (API keys, bearer tokens, or
 * URL query strings that embed an `apiKey`/`key=` parameter). Provider
 * servers sometimes echo the incoming request URL or headers in their error
 * payloads — without this step, those secrets would land in HttpsError
 * messages that are forwarded to the client and logs.
 */
export function redactSecrets(text: string): string {
  return text
    // Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9._~+/\-]+=*/gi, "Bearer [REDACTED]")
    // Gemini/Google style ?key=..., &key=..., "key":"..."
    .replace(/([?&](?:key|api_?key|access_token)=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/("(?:api_?key|key|access_token|authorization)"\s*:\s*")[^"]+(")/gi, "$1[REDACTED]$2")
    // Known key prefixes (OpenAI sk-, Anthropic sk-ant-, Google AIza)
    .replace(/sk-ant-[A-Za-z0-9_\-]{10,}/g, "[REDACTED]")
    .replace(/sk-[A-Za-z0-9_\-]{20,}/g, "[REDACTED]")
    .replace(/AIza[A-Za-z0-9_\-]{20,}/g, "[REDACTED]");
}

export async function readErrorBodyExcerpt(response: Response, maxChars = 500): Promise<string> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return "";
  }
  if (!text) return "";
  const redacted = redactSecrets(text);
  const collapsed = redacted.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxChars) return collapsed;
  return `${collapsed.slice(0, maxChars)}…`;
}

export async function requireOk(response: Response, provider: string) {
  if (response.ok) return;
  const excerpt = await readErrorBodyExcerpt(response);
  const detail = excerpt ? `: ${excerpt}` : response.statusText ? `: ${response.statusText}` : "";
  throw new HttpsError(
    "internal",
    `${provider} API request failed (${response.status})${detail}`
  );
}
