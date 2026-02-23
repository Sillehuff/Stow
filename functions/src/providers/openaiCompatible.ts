import { extractJsonObject, normalizeSuggestion, requireOk } from "./common.js";
import type { ProviderContext, VisionProviderAdapter } from "./types.js";

function toDataUrl(mimeType: string, bytes: Buffer) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export const openaiCompatibleAdapter: VisionProviderAdapter = {
  async classifyImage({ apiKey, config, prompt, image }: ProviderContext) {
    const baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
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
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    return normalizeSuggestion(extractJsonObject(content));
  },

  async validate({ apiKey, config }) {
    const baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!response.ok) {
      return { ok: false, message: `Model list failed (${response.status})` };
    }
    return { ok: true, message: "Connection successful" };
  }
};
