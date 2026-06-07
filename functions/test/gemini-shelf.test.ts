import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiAdapter } from "../src/providers/gemini.js";
import type { HouseholdLlmConfig } from "../src/shared/schemas.js";

const config: HouseholdLlmConfig = {
  enabled: true,
  providerType: "gemini",
  model: "gemini-2.0-flash",
  promptProfile: "default_inventory"
};

const image = { mimeType: "image/jpeg", bytes: Buffer.from("fake") };

function mockFetchOnceWithText(text: string) {
  const body = { candidates: [{ content: { parts: [{ text }] } }] };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    )
  );
}

describe("geminiAdapter.detectShelfItems", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("maps Gemini box_2d [ymin,xmin,ymax,xmax] 0..1000 to bbox [x,y,w,h] 0..1", async () => {
    mockFetchOnceWithText(
      JSON.stringify([
        { label: "Mechanical Keyboard", confidence: 0.97, box_2d: [150, 110, 440, 560] },
        { label: "Headphones", confidence: 0.61, box_2d: [190, 630, 420, 900] }
      ])
    );
    const detections = await geminiAdapter.detectShelfItems!({ apiKey: "k", config, prompt: "p", image });
    expect(detections).toHaveLength(2);
    expect(detections[0].label).toBe("Mechanical Keyboard");
    expect(detections[0].confidence).toBeCloseTo(0.97, 5);
    expect(detections[0].bbox[0]).toBeCloseTo(0.11, 5);
    expect(detections[0].bbox[1]).toBeCloseTo(0.15, 5);
    expect(detections[0].bbox[2]).toBeCloseTo(0.45, 5);
    expect(detections[0].bbox[3]).toBeCloseTo(0.29, 5);
    expect(detections[1].bbox[0]).toBeCloseTo(0.63, 5);
    expect(detections[1].bbox[1]).toBeCloseTo(0.19, 5);
    expect(detections[1].bbox[2]).toBeCloseTo(0.27, 5);
    expect(detections[1].bbox[3]).toBeCloseTo(0.23, 5);
  });

  it("tolerates a fenced JSON object wrapper and clamps to [0,1]", async () => {
    mockFetchOnceWithText(
      '```json\n{ "items": [ { "label": "Box", "confidence": 0.5, "box_2d": [0, 0, 1100, 1000] }, { "label": "Overflow", "confidence": 0.7, "box_2d": [900, 900, 1100, 1100] } ] }\n```'
    );
    const detections = await geminiAdapter.detectShelfItems!({ apiKey: "k", config, prompt: "p", image });
    expect(detections).toHaveLength(2);
    expect(detections[0].bbox[3]).toBeCloseTo(1, 5);
    expect(detections[0].bbox).toEqual(detections[0].bbox.map((n) => Math.min(1, Math.max(0, n))));
    expect(detections[1].bbox[0]).toBeCloseTo(0.9, 5);
    expect(detections[1].bbox[1]).toBeCloseTo(0.9, 5);
    expect(detections[1].bbox[2]).toBeCloseTo(0.1, 5);
    expect(detections[1].bbox[3]).toBeCloseTo(0.1, 5);
  });

  it("drops malformed detections", async () => {
    mockFetchOnceWithText(
      JSON.stringify([
        { label: "Good", confidence: 0.8, box_2d: [10, 10, 100, 100] },
        { label: "NoBox", confidence: 0.8 },
        { label: "ShortBox", confidence: 0.8, box_2d: [1, 2, 3] },
        { label: "", confidence: 0.8, box_2d: [10, 10, 100, 100] },
        { label: "BadConf", confidence: 5, box_2d: [10, 10, 100, 100] }
      ])
    );
    const detections = await geminiAdapter.detectShelfItems!({ apiKey: "k", config, prompt: "p", image });
    expect(detections.map((d) => d.label)).toEqual(["Good"]);
  });
});
