import { HttpsError } from "firebase-functions/v2/https";
import { isPublicHttpsUrl } from "../shared/schemas.js";
import { extractJsonObject, normalizeSuggestion, parseProviderJson, providerFetch, requireOk } from "./common.js";
import type { ProviderContext, VisionProviderAdapter } from "./types.js";

function toDataUrl(mimeType: string, bytes: Buffer) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

// Defense-in-depth: re-validate the configured baseUrl at call time so a config
// persisted before SSRF validation (or any non-https/private host) cannot turn
// the function into an SSRF pivot carrying the household's API key.
function resolveBaseUrl(baseUrl?: string): string {
  if (!baseUrl) return "https://api.openai.com/v1";
  if (!isPublicHttpsUrl(baseUrl)) {
    throw new HttpsError("invalid-argument", "AI provider baseUrl must be an https URL to a public host");
  }
  return baseUrl.replace(/\/+$/, "");
}

export const openaiCompatibleAdapter: VisionProviderAdapter = {
  async classifyImage({ apiKey, config, prompt, image }: ProviderContext) {
    const baseUrl = resolveBaseUrl(config.baseUrl);
    const response = await providerFetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature ?? 0.2,
        max_tokens: config.maxTokens ?? 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Categorize this item image." },
              {
                type: "image_url",
                image_url: {
                  url: toDataUrl(image.mimeType, image.bytes)
                }
              }
            ]
          }
        ]
      })
    });
    requireOk(response, "OpenAI-compatible");
    const body = parseProviderJson(response.text) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    return normalizeSuggestion(extractJsonObject(content));
  },

  async validate({ apiKey, config }) {
    const baseUrl = resolveBaseUrl(config.baseUrl);
    const response = await providerFetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!response.ok) {
      return { ok: false, message: `Model list failed (${response.status})` };
    }
    return { ok: true, message: "Connection successful" };
  }
};
