import { HttpsError } from "firebase-functions/v2/https";
import { extractJsonObject, normalizeSuggestion, parseProviderJson, providerFetch, requireOk } from "./common.js";
import { shelfDetectionSchema, type ShelfDetection } from "../shared/schemas.js";
import type { ProviderContext, ShelfDetectContext, VisionProviderAdapter } from "./types.js";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

type GeminiGenerateContentResponse = {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

function parseGeminiResponse(text: string): GeminiGenerateContentResponse {
  return parseProviderJson(text) as GeminiGenerateContentResponse;
}

function throwIfBlocked(body: GeminiGenerateContentResponse) {
  const blockReason = body.promptFeedback?.blockReason;
  if (blockReason) {
    throw new HttpsError("internal", `Provider blocked the request (${blockReason})`);
  }
}

function candidateFinishReason(body: GeminiGenerateContentResponse): string | undefined {
  return body.candidates?.[0]?.finishReason;
}

function candidateText(body: GeminiGenerateContentResponse): string {
  return body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
}

function isIncompleteFinish(finishReason: string | undefined): finishReason is string {
  return Boolean(finishReason && finishReason !== "STOP");
}

function incompleteResponseError(finishReason: string): HttpsError {
  const suffix = finishReason === "MAX_TOKENS" ? " — raise the max tokens setting" : "";
  return new HttpsError("internal", `Provider response incomplete (${finishReason})${suffix}`);
}

function extractDetectionArray(text: string): unknown[] {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      for (const key of ["items", "detections", "objects", "results"]) {
        const value = (parsed as Record<string, unknown>)[key];
        if (Array.isArray(value)) return value;
      }
    }
  } catch {
    // Fall through to bracket extraction for loose model responses.
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to object extraction.
    }
  }

  const parsed = extractJsonObject(trimmed);
  if (parsed && typeof parsed === "object") {
    for (const key of ["items", "detections", "objects", "results"]) {
      const value = (parsed as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function mapDetection(raw: unknown): ShelfDetection | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const box = candidate.box_2d ?? candidate.bbox ?? candidate.box;
  if (!Array.isArray(box) || box.length < 4) return null;

  const ymin = Number(box[0]);
  const xmin = Number(box[1]);
  const ymax = Number(box[2]);
  const xmax = Number(box[3]);
  if ([ymin, xmin, ymax, xmax].some((value) => !Number.isFinite(value))) return null;
  const x1 = clamp01(xmin / 1000);
  const y1 = clamp01(ymin / 1000);
  const x2 = clamp01(xmax / 1000);
  const y2 = clamp01(ymax / 1000);

  const mapped = {
    label:
      typeof candidate.label === "string"
        ? candidate.label
        : typeof candidate.name === "string"
          ? candidate.name
          : "",
    confidence: Number(candidate.confidence),
    bbox: [
      x1,
      y1,
      Math.max(0, x2 - x1),
      Math.max(0, y2 - y1)
    ] as [number, number, number, number],
    ...(Number.isFinite(Number(candidate.suggestedValue))
      ? { suggestedValue: Number(candidate.suggestedValue) }
      : {}),
    ...(Array.isArray(candidate.tags)
      ? { tags: candidate.tags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0) }
      : {})
  };

  const parsed = shelfDetectionSchema.safeParse(mapped);
  return parsed.success ? parsed.data : null;
}

export function shelfDetectionPrompt(extraContext?: { areaName?: string }) {
  return [
    "You detect every distinct physical household object on one still photo of a shelf or surface.",
    "Return STRICT JSON: an array of objects, each with keys: label, confidence, box_2d.",
    "label: a short human item name (avoid guessing exact brand/model unless clearly visible).",
    "confidence: a number between 0 and 1.",
    "box_2d: [ymin, xmin, ymax, xmax] as integers normalized to 0..1000 (Gemini bounding-box convention).",
    "You MAY include an optional numeric suggestedValue (USD) and a short tags array.",
    "Do not include duplicates, people, or background surfaces. Return [] if nothing is identifiable.",
    extraContext?.areaName ? `These items are being filed into area: ${extraContext.areaName}.` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

export const geminiAdapter: VisionProviderAdapter = {
  async classifyImage({ apiKey, config, prompt, image }: ProviderContext) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await providerFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: config.temperature ?? 0.2,
          maxOutputTokens: config.maxTokens ?? 400
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: `${prompt} Categorize this item image and return strict JSON only.` },
              {
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.bytes.toString("base64")
                }
              }
            ]
          }
        ]
      })
    });
    requireOk(response, "Gemini");
    const body = parseGeminiResponse(response.text);
    throwIfBlocked(body);
    const finishReason = candidateFinishReason(body);
    const text = candidateText(body);
    if (isIncompleteFinish(finishReason)) {
      try {
        return normalizeSuggestion(extractJsonObject(text));
      } catch {
        throw incompleteResponseError(finishReason);
      }
    }
    return normalizeSuggestion(extractJsonObject(text));
  },

  async validate({ apiKey, config }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}?key=${encodeURIComponent(apiKey)}`;
    const response = await providerFetch(url, {});
    if (!response.ok) return { ok: false, message: `Model lookup failed (${response.status})` };
    return { ok: true, message: "Connection successful" };
  },

  async detectShelfItems({ apiKey, config, prompt, image }: ShelfDetectContext) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await providerFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: config.temperature ?? 0.1,
          maxOutputTokens: Math.max(config.maxTokens ?? 1024, 1024)
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: `${prompt} Return strict JSON only.` },
              {
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.bytes.toString("base64")
                }
              }
            ]
          }
        ]
      })
    });
    requireOk(response, "Gemini");
    const body = parseGeminiResponse(response.text);
    throwIfBlocked(body);
    const finishReason = candidateFinishReason(body);
    const text = candidateText(body);
    // Unlike classifyImage (one JSON object — parseable means complete), a shelf
    // response is an ARRAY: truncation mid-array yields a parseable prefix that
    // looks like a finished scan. Committing half a shelf silently is worse than
    // asking the user to rescan, so any non-STOP finish is an error here.
    if (isIncompleteFinish(finishReason)) {
      throw incompleteResponseError(finishReason);
    }
    return extractDetectionArray(text)
      .map(mapDetection)
      .filter((detection): detection is ShelfDetection => detection !== null);
  }
};
