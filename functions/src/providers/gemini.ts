import { extractJsonObject, normalizeSuggestion, requireOk } from "./common.js";
import type { ProviderContext, VisionProviderAdapter } from "./types.js";

export const geminiAdapter: VisionProviderAdapter = {
  async classifyImage({ apiKey, config, prompt, image }: ProviderContext) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
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
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    return normalizeSuggestion(extractJsonObject(text));
  },

  async validate({ apiKey, config }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    if (!response.ok) return { ok: false, message: `Model lookup failed (${response.status})` };
    return { ok: true, message: "Connection successful" };
  }
};
