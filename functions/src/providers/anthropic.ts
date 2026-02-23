import { extractJsonObject, normalizeSuggestion, requireOk } from "./common.js";
import type { ProviderContext, VisionProviderAdapter } from "./types.js";

export const anthropicAdapter: VisionProviderAdapter = {
  async classifyImage({ apiKey, config, prompt, image }: ProviderContext) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens ?? 400,
        temperature: config.temperature ?? 0.2,
        system: prompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mimeType,
                  data: image.bytes.toString("base64")
                }
              },
              {
                type: "text",
                text: "Categorize this item image. Return strict JSON only."
              }
            ]
          }
        ]
      })
    });
    requireOk(response, "Anthropic");
    const body = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = body.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n") ?? "";
    return normalizeSuggestion(extractJsonObject(text));
  },

  async validate({ apiKey, config }) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with OK" }]
      })
    });
    if (!response.ok) return { ok: false, message: `Validation request failed (${response.status})` };
    return { ok: true, message: "Connection successful" };
  }
};
