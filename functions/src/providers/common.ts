import { HttpsError } from "firebase-functions/v2/https";
import { visionSuggestionSchema, type VisionSuggestion } from "../shared/schemas.js";

const PROVIDER_TIMEOUT_MS = 30_000;

export type ProviderFetchResult = {
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
};

/** fetch with a hard timeout — a hung provider must not pin the function until the platform kills it. */
export async function providerFetch(
  url: string,
  init: RequestInit,
  timeoutMs = PROVIDER_TIMEOUT_MS
): Promise<ProviderFetchResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new HttpsError("deadline-exceeded", "AI provider request timed out"));
    }, timeoutMs);
  });
  try {
    // redirect: "error" prevents a provider host from redirecting the request
    // (and the Bearer key) to an internal address — SSRF defense-in-depth. It is
    // placed AFTER the init spread so no caller can accidentally override it.
    const response = await Promise.race([
      fetch(url, { ...init, redirect: "error", signal: controller.signal }),
      timeout
    ]);
    const text = await Promise.race([response.text(), timeout]);
    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      text
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new HttpsError("deadline-exceeded", "AI provider request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer!);
  }
}

export function parseProviderJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpsError("internal", "Provider response was not valid JSON");
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
    // Try extracting first JSON object block. The slice can still be invalid JSON
    // (e.g. "{a: {b} garbage"), so guard the parse too — otherwise a raw SyntaxError
    // escapes instead of the intended HttpsError.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        throw new HttpsError("internal", "Provider response was not valid JSON");
      }
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

export function requireOk(response: ProviderFetchResult, provider: string) {
  if (!response.ok) {
    throw new HttpsError(
      "internal",
      `${provider} API request failed (${response.status})`
    );
  }
}
