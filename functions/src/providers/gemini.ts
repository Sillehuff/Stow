import { extractJsonObject, normalizeSuggestion, providerFetch } from "./common.js";
import type { ProviderContext, VisionProviderAdapter } from "./types.js";

export const geminiAdapter: VisionProviderAdapter = {
  async classifyImage({ apiKey, config, prompt, image }: ProviderContext) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await providerFetch(
      "Gemini",
      url,
      {
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
      },
      { retries: 2, retryDelayMs: 1000 }
    );
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    return normalizeSuggestion(extractJsonObject(text));
  },

  async validate({ apiKey, config }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}?key=${encodeURIComponent(apiKey)}`;
    try {
      await providerFetch("Gemini", url);
      return { ok: true, message: "Connection successful" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message
      };
    }
  }
};
