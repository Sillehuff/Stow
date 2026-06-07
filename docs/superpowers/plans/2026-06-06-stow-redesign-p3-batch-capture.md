# Stow Mobile Redesign — P3 Whole-Shelf Batch Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the headline feature — photograph a whole shelf, detect every object on a single still frame (Gemini multi-object detection), review the detections least-confident-first (name / confirm / skip, ranked-guess chips, match %), retarget the destination, and batch-commit the kept items to inventory — honest about the snapshot model throughout. Backend callable + schemas + provider mapping, a pure review-state reducer, the `QuickCapture` UI, and the `ScanOverlay` "Whole shelf" launch are all in scope.

**Architecture:** A new Cloud Function callable `visionDetectShelfItems` mirrors the existing `visionCategorizeItemImage` handler (zod parse → `requireHouseholdMember` → `loadConfigAndSecret` → `config.enabled` → `resolveImage` household-prefix guard + download/MIME/size → `getVisionAdapter` → adapter call → write `visionJobs` doc → return). Gemini gains an optional `detectShelfItems` adapter method that prompts for a JSON array `{label, confidence, box_2d:[ymin,xmin,ymax,xmax] 0..1000}` and maps to our `ShelfDetection[]` (`bbox:[x,y,w,h]` normalized 0..1). On the client, a pure `captureReducer` state machine (`analyzing → detected → review → destination → done`) drives `QuickCapture.tsx`; committing calls `repository.createItemsBatch`. Everything new on the client lives under `src/features/stow/ui/mobile/` and reads CSS custom properties (no `P` prop).

**Tech Stack:** React 19 + TypeScript, Firebase Functions v2 (`onCall`), Zod, lucide-react, Vite, Vitest (node env, pure-function tests — repo has no jsdom/RTL), Playwright (mobile viewport, Firebase emulators).

**Spec:** `docs/superpowers/specs/2026-06-06-stow-mobile-redesign-design.md` (§6.9, §7.6, §9 QuickCapture) · **Roadmap:** `docs/superpowers/plans/2026-06-06-stow-mobile-redesign-roadmap.md` ("P3" section) · **Contract (LOCKED):** `docs/superpowers/plans/2026-06-06-stow-redesign-shared-contract.md` (§0 conventions, §4 P3 llm types, §5.2 `createItemsBatch`/`NewBatchItem`, §6.2, §9.3 captureReducer/QuickCapture, §9.4 backend).

**Conventions (contract §0):**
- TDD bite-sized steps: write failing test → run (expect fail) → minimal/full impl → run (expect pass) → commit. One action per step (2–5 min).
- Run a single client test file with `npx vitest run <path>`; the full client unit suite with `npm test` (excludes rules + smoke). Functions tests run with `npm run functions:test` (schema/provider tests live under `functions/test/`).
- There is **no `verify` script**; "verify" = `npm run typecheck && npm test && npm run build`. Functions verified additionally with `npm run functions:test`.
- Tests are pure-function / node-env only. Test the reducer, schemas, and the provider box-mapping. `QuickCapture` (UI) is validated by manual dev load + Playwright with a mocked callable — **not** unit DOM tests.
- End every commit message with the repo trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Do not touch** legacy `src/features/stow/ui/StowApp.tsx`, `ui/next/StowNextApp.tsx`, `ui/tabs`, `ui/item`, `ui/shared`, or canonical routes — those move at P5.
- **Cross-phase interfaces come from the contract.** P0–P2 are assumed complete: `src/features/stow/ui/mobile/` exists with `theme/`, `shell/`, `hooks/useMobileNavigation.ts`, `StowMobileApp.tsx`, `components/`, and (P2) `capture/ScanOverlay.tsx` with an `onCaptureShelf?` hook, `hooks/useCamera.ts`, `capture/PhotoSource.tsx`. This plan adds the shelf-detection slice.
- **Activity logging is P4.** `createItemsBatch` does **not** log activity; the `QuickCapture` `onCommitted` call site is where P4 will wire `logActivity(items_added_batch, count)`. Mark that point in a comment; do not implement it here.

---

## Task 1: Shelf-detection Zod schemas (functions)

Add the request/detection/result schemas to the functions shared schema module, mirroring the existing `visionCategorizeInputSchema` / `visionSuggestionSchema` style (`functions/src/shared/schemas.ts`). `bbox` is a 4-tuple of numbers; `confidence` is 0..1.

**Files:**
- Modify: `functions/src/shared/schemas.ts`
- Modify (tests): `functions/test/schemas.test.ts`

- [x] **Step 1: Write the failing tests** — append to the existing `describe("shared schemas", …)` block in `functions/test/schemas.test.ts`.

Add the imports at the top of the file (extend the existing import list):
```ts
import {
  createInviteInputSchema,
  llmConfigSchema,
  visionCategorizeInputSchema,
  visionSuggestionSchema,
  visionDetectShelfInputSchema,
  shelfDetectionSchema,
  visionDetectShelfResultSchema
} from "../src/shared/schemas.js";
```

Add these tests inside the `describe` block:
```ts
  it("validates shelf-detection requests", () => {
    expect(() =>
      visionDetectShelfInputSchema.parse({
        householdId: "h1",
        imageRef: { storagePath: "households/h1/items/item-1/image.jpg" },
        spaceId: "s1",
        areaId: "a1",
        areaName: "Shelf"
      })
    ).not.toThrow();
    // imageRef is required
    expect(() => visionDetectShelfInputSchema.parse({ householdId: "h1" })).toThrow();
    // householdId must be non-empty
    expect(() =>
      visionDetectShelfInputSchema.parse({ householdId: "", imageRef: { storagePath: "x" } })
    ).toThrow();
  });

  it("validates a single shelf detection", () => {
    expect(() =>
      shelfDetectionSchema.parse({
        label: "Mechanical Keyboard",
        confidence: 0.97,
        bbox: [0.11, 0.15, 0.45, 0.29],
        suggestedValue: 140,
        tags: ["Tech", "Work"]
      })
    ).not.toThrow();
    // suggestedValue and tags are optional
    expect(() =>
      shelfDetectionSchema.parse({ label: "Box", confidence: 0.5, bbox: [0, 0, 1, 1] })
    ).not.toThrow();
    // confidence out of range rejected
    expect(() =>
      shelfDetectionSchema.parse({ label: "Box", confidence: 1.4, bbox: [0, 0, 1, 1] })
    ).toThrow();
    // bbox must have exactly 4 numbers
    expect(() =>
      shelfDetectionSchema.parse({ label: "Box", confidence: 0.5, bbox: [0, 0, 1] })
    ).toThrow();
    // empty label rejected
    expect(() =>
      shelfDetectionSchema.parse({ label: "", confidence: 0.5, bbox: [0, 0, 1, 1] })
    ).toThrow();
  });

  it("validates a shelf-detection result envelope", () => {
    expect(() =>
      visionDetectShelfResultSchema.parse({
        detections: [{ label: "Box", confidence: 0.5, bbox: [0, 0, 1, 1] }],
        provider: "gemini",
        jobId: "job-1"
      })
    ).not.toThrow();
    // empty detections array is allowed (nothing found)
    expect(() =>
      visionDetectShelfResultSchema.parse({ detections: [], provider: "gemini", jobId: "job-1" })
    ).not.toThrow();
  });
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npm run functions:test`
Expected: FAIL — `visionDetectShelfInputSchema`/`shelfDetectionSchema`/`visionDetectShelfResultSchema` are not exported (import error).

- [x] **Step 3: Write the implementation** — append to `functions/src/shared/schemas.ts` (after `visionSuggestionSchema`, reusing the existing `visionImageRefSchema`).

```ts
export const visionDetectShelfInputSchema = z.object({
  householdId: z.string().min(1),
  imageRef: visionImageRefSchema,
  spaceId: z.string().optional(),
  areaId: z.string().optional(),
  areaName: z.string().optional()
});
export type VisionDetectShelfInput = z.infer<typeof visionDetectShelfInputSchema>;

export const shelfDetectionSchema = z.object({
  label: z.string().min(1),
  confidence: z.number().min(0).max(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  suggestedValue: z.number().nonnegative().optional(),
  tags: z.array(z.string().min(1)).max(15).optional()
});
export type ShelfDetection = z.infer<typeof shelfDetectionSchema>;

export const visionDetectShelfResultSchema = z.object({
  detections: z.array(shelfDetectionSchema),
  provider: z.string().min(1),
  jobId: z.string().min(1)
});
export type VisionDetectShelfResult = z.infer<typeof visionDetectShelfResultSchema>;
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `npm run functions:test`
Expected: PASS (existing tests + the 3 new shelf-schema tests).

- [x] **Step 5: Commit**

```bash
git add functions/src/shared/schemas.ts functions/test/schemas.test.ts
git commit -m "feat(functions): add shelf-detection Zod schemas"
```

---

## Task 2: Provider adapter method + Gemini box-mapping

Add an optional `detectShelfItems` to the `VisionProviderAdapter` interface and implement it in the Gemini adapter. The method prompts for a JSON array of `{label, confidence, box_2d:[ymin,xmin,ymax,xmax]}` where `box_2d` is normalized 0..1000 (Gemini's native bounding-box convention), and maps each detection to a `ShelfDetection` with `bbox:[x,y,w,h]` normalized 0..1. Other providers leave the method undefined (treated as unsupported downstream).

The mapping (Gemini `[ymin, xmin, ymax, xmax]` in 0..1000 → our `[x, y, w, h]` in 0..1):
```
x = xmin / 1000
y = ymin / 1000
w = (xmax - xmin) / 1000
h = (ymax - ymin) / 1000
```
Values are clamped to `[0, 1]` and `w`/`h` floored at 0 (defensive against a provider returning reversed corners).

**Files:**
- Modify: `functions/src/providers/types.ts`
- Modify: `functions/src/providers/gemini.ts`
- Create (tests): `functions/test/gemini.test.ts` *(if it already exists from P2, append a new `describe` block instead)*

- [ ] **Step 1: Extend the adapter interface** — `functions/src/providers/types.ts`.

Add the import and the optional method (the result type is the Zod-inferred `ShelfDetection` from Task 1):
```ts
import type { HouseholdLlmConfig, VisionSuggestion, ShelfDetection } from "../shared/schemas.js";
```
Add a context type for shelf detection and the optional method on the interface:
```ts
export type ShelfDetectContext = {
  apiKey: string;
  config: HouseholdLlmConfig;
  prompt: string;
  image: VisionImageInput;
};

export interface VisionProviderAdapter {
  classifyImage(context: ProviderContext): Promise<VisionSuggestion>;
  validate(context: { apiKey: string; config: HouseholdLlmConfig }): Promise<{ ok: boolean; message: string }>;
  detectShelfItems?(context: ShelfDetectContext): Promise<ShelfDetection[]>;
}
```

- [ ] **Step 2: Write the failing provider-mapping test** — `functions/test/gemini.test.ts`.

This test mocks `globalThis.fetch` to return a Gemini `generateContent` body whose candidate text is a JSON array using `box_2d` in 0..1000, and asserts the adapter maps to `bbox` in 0..1 (and orders/maps fields correctly).

```ts
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
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }))
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
    // first: x=0.110, y=0.150, w=(560-110)/1000=0.450, h=(440-150)/1000=0.290
    expect(detections[0].label).toBe("Mechanical Keyboard");
    expect(detections[0].confidence).toBeCloseTo(0.97, 5);
    expect(detections[0].bbox[0]).toBeCloseTo(0.11, 5);
    expect(detections[0].bbox[1]).toBeCloseTo(0.15, 5);
    expect(detections[0].bbox[2]).toBeCloseTo(0.45, 5);
    expect(detections[0].bbox[3]).toBeCloseTo(0.29, 5);
    // second box
    expect(detections[1].bbox[0]).toBeCloseTo(0.63, 5);
    expect(detections[1].bbox[1]).toBeCloseTo(0.19, 5);
    expect(detections[1].bbox[2]).toBeCloseTo(0.27, 5);
    expect(detections[1].bbox[3]).toBeCloseTo(0.23, 5);
  });

  it("tolerates a fenced JSON object wrapper and clamps to [0,1]", async () => {
    mockFetchOnceWithText(
      "```json\n{ \"items\": [ { \"label\": \"Box\", \"confidence\": 0.5, \"box_2d\": [0, 0, 1100, 1000] } ] }\n```"
    );
    const detections = await geminiAdapter.detectShelfItems!({ apiKey: "k", config, prompt: "p", image });
    expect(detections).toHaveLength(1);
    // ymax 1100/1000 clamps; h = clamp(1.0) - 0 = 1
    expect(detections[0].bbox[3]).toBeCloseTo(1, 5);
    expect(detections[0].bbox).toEqual(detections[0].bbox.map((n) => Math.min(1, Math.max(0, n))));
  });

  it("drops malformed detections (missing/short box, bad confidence, empty label)", async () => {
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run functions:test`
Expected: FAIL — `geminiAdapter.detectShelfItems` is `undefined` (calling `!(...)` throws / type error), or the mapping is missing.

- [ ] **Step 4: Write the implementation** — `functions/src/providers/gemini.ts`.

Add the shelf prompt + mapping helpers and the `detectShelfItems` method. Reuse `extractJsonObject` for fenced/loose JSON, but support a top-level **array** as well as an object wrapper (the existing `extractJsonObject` only handles objects, so add a small array-aware parse here). Validate each mapped detection with `shelfDetectionSchema.safeParse` and drop failures (so one bad row doesn't fail the whole call).

```ts
import { extractJsonObject, normalizeSuggestion, requireOk } from "./common.js";
import { shelfDetectionSchema, type ShelfDetection } from "../shared/schemas.js";
import type { ProviderContext, ShelfDetectContext, VisionProviderAdapter } from "./types.js";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Parse a JSON array (or an object that wraps one under common keys) from possibly-fenced model text. */
function extractDetectionArray(text: string): unknown[] {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
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
    // fall through to bracket extraction
  }
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      const arr = JSON.parse(trimmed.slice(start, end + 1));
      if (Array.isArray(arr)) return arr;
    } catch {
      // ignore
    }
  }
  // Last resort: an object wrapper via the shared extractor.
  const obj = extractJsonObject(trimmed);
  if (obj && typeof obj === "object") {
    for (const key of ["items", "detections", "objects", "results"]) {
      const value = (obj as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

/** Map Gemini box_2d [ymin,xmin,ymax,xmax] (0..1000) to our bbox [x,y,w,h] (0..1). */
function mapDetection(raw: unknown): ShelfDetection | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const box = r.box_2d ?? r.bbox ?? r.box;
  if (!Array.isArray(box) || box.length < 4) return null;
  const [ymin, xmin, ymax, xmax] = box.map((n) => Number(n));
  if ([ymin, xmin, ymax, xmax].some((n) => !Number.isFinite(n))) return null;
  const x = clamp01(xmin / 1000);
  const y = clamp01(ymin / 1000);
  const w = clamp01(Math.max(0, (xmax - xmin) / 1000));
  const h = clamp01(Math.max(0, (ymax - ymin) / 1000));
  const candidate = {
    label: typeof r.label === "string" ? r.label : typeof r.name === "string" ? r.name : "",
    confidence: Number(r.confidence),
    bbox: [x, y, w, h] as [number, number, number, number],
    ...(Number.isFinite(Number(r.suggestedValue)) ? { suggestedValue: Number(r.suggestedValue) } : {}),
    ...(Array.isArray(r.tags) ? { tags: (r.tags as unknown[]).filter((t): t is string => typeof t === "string" && t.length > 0) } : {})
  };
  const parsed = shelfDetectionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function shelfDetectionPrompt(extraContext?: { areaName?: string }): string {
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
```

Then add the method to the `geminiAdapter` object (after `validate`):
```ts
  async detectShelfItems({ apiKey, config, prompt, image }: ShelfDetectContext) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: config.temperature ?? 0.1,
          maxOutputTokens: config.maxTokens ?? 1024
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: `${prompt} Return strict JSON only.` },
              { inlineData: { mimeType: image.mimeType, data: image.bytes.toString("base64") } }
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
    return extractDetectionArray(text)
      .map(mapDetection)
      .filter((d): d is ShelfDetection => d !== null);
  }
```

> The handler (Task 3) supplies `prompt` via `shelfDetectionPrompt(...)`; keep the prompt out of the adapter so behavior stays consistent with `classifyImage`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run functions:test`
Expected: PASS (schemas + the 3 gemini mapping tests).

- [ ] **Step 6: Commit**

```bash
git add functions/src/providers/types.ts functions/src/providers/gemini.ts functions/test/gemini.test.ts
git commit -m "feat(functions): add Gemini shelf detection with box_2d->bbox mapping"
```

---

## Task 3: `visionDetectShelfItemsHandler` callable

Add the handler to `functions/src/vision.ts`, mirroring `visionCategorizeItemImageHandler` exactly (reuse the file's existing `resolveImage` household-prefix guard and `downloadStorageFile`). The one new branch: if the resolved adapter has no `detectShelfItems`, throw `failed-precondition`. Write a `visionJobs` doc and return `{ detections, provider, jobId }` shaped per `VisionDetectShelfResponse` (contract §4).

**Files:**
- Modify: `functions/src/vision.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add the handler** — `functions/src/vision.ts`.

Extend the schema import:
```ts
import { visionCategorizeInputSchema, visionDetectShelfInputSchema } from "./shared/schemas.js";
```
Add a prompt import (the prompt builder from Task 2 lives in the gemini module; re-export it from `providers/common.ts` is cleaner — but to avoid coupling the handler to one provider file, import it directly):
```ts
import { shelfDetectionPrompt } from "./providers/gemini.js";
```
> Rationale: `inventoryVisionPrompt` already lives in `providers/common.ts`; `shelfDetectionPrompt` is provider-agnostic text but currently defined in `gemini.ts`. If a future non-Gemini provider implements `detectShelfItems`, move `shelfDetectionPrompt` to `providers/common.ts` and update both imports. For P3 (Gemini only) importing from `gemini.js` is acceptable and avoids a churn commit.

Append the handler after `visionCategorizeItemImageHandler`:
```ts
export async function visionDetectShelfItemsHandler(raw: unknown, uid: string) {
  const input = visionDetectShelfInputSchema.parse(raw);
  await requireHouseholdMember(input.householdId, uid);
  const { config, apiKey } = await loadConfigAndSecret(input.householdId);
  if (!config.enabled) throw new HttpsError("failed-precondition", "Vision categorization is disabled for this household");

  const image = await resolveImage(input.householdId, input.imageRef);
  const adapter = getVisionAdapter(config.providerType);
  if (!adapter.detectShelfItems) {
    throw new HttpsError("failed-precondition", "Shelf detection unsupported for this provider");
  }
  const prompt = shelfDetectionPrompt({ areaName: input.areaName });

  const startedAt = Date.now();
  const detections = await adapter.detectShelfItems({ apiKey, config, prompt, image });
  const latencyMs = Date.now() - startedAt;

  const visionJobRef = db.collection(paths.visionJobs(input.householdId)).doc();
  await visionJobRef.set({
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    providerType: config.providerType,
    model: config.model,
    latencyMs,
    kind: "shelf_detect",
    detectionCount: detections.length,
    context: {
      spaceId: input.spaceId ?? null,
      areaId: input.areaId ?? null,
      areaName: input.areaName ?? null
    }
  });

  return {
    detections,
    provider: config.providerType,
    jobId: visionJobRef.id
  };
}
```

- [ ] **Step 2: Export the callable** — `functions/src/index.ts`.

Extend the vision import:
```ts
import { visionCategorizeItemImageHandler, visionDetectShelfItemsHandler } from "./vision.js";
```
Add the export after `visionCategorizeItemImage` (mirrors the auth-guard + `mapError` pattern):
```ts
export const visionDetectShelfItems = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await visionDetectShelfItemsHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});
```

- [ ] **Step 3: Typecheck + build functions**

Run: `npm run functions:build`
Expected: PASS (TypeScript compiles; `detectShelfItems` optional-method narrowing satisfied by the `if (!adapter.detectShelfItems)` guard).

- [ ] **Step 4: Run functions tests** (no behavior change expected, but confirm the build didn't break imports)

Run: `npm run functions:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/vision.ts functions/src/index.ts
git commit -m "feat(functions): export visionDetectShelfItems callable"
```

---

## Task 4: Client shelf types + callable wrapper

Add the P3 shelf types to `src/types/llm.ts` (contract §4) and the `visionDetectShelfItems` wrapper to `src/lib/firebase/functions.ts`, mirroring `visionCategorizeItemImage`.

**Files:**
- Modify: `src/types/llm.ts`
- Modify: `src/lib/firebase/functions.ts`

- [ ] **Step 1: Add the types** — append to `src/types/llm.ts` (exact shape per contract §4):

```ts
export interface ShelfDetection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
  suggestedValue?: number;
  tags?: string[];
}

export interface VisionDetectShelfRequest {
  householdId: string;
  imageRef: { storagePath: string };
  spaceId?: string;
  areaId?: string;
  areaName?: string;
}

export interface VisionDetectShelfResponse {
  detections: ShelfDetection[];
  provider: string;
  jobId: string;
}
```

- [ ] **Step 2: Add the wrapper** — `src/lib/firebase/functions.ts`.

Extend the type import:
```ts
import type {
  HouseholdLlmConfig,
  VisionCategorizeRequest,
  VisionCategorizeResponse,
  VisionDetectShelfRequest,
  VisionDetectShelfResponse
} from "@/types/llm";
```
Append the wrapper after `visionCategorizeItemImage`:
```ts
export async function visionDetectShelfItems(
  input: VisionDetectShelfRequest
): Promise<VisionDetectShelfResponse> {
  return callFunction<VisionDetectShelfRequest, VisionDetectShelfResponse>("visionDetectShelfItems", input);
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/types/llm.ts src/lib/firebase/functions.ts
git commit -m "feat(mobile): add shelf-detection client types and callable wrapper"
```

---

## Task 5: `repository.createItemsBatch` + `useWorkspaceData` action

Add the batch-create repository method (contract §5.2) and expose it through `useWorkspaceData.actions` (contract §6.2). Each item mirrors `createItem`'s defaults via one `writeBatch`. **No activity logging here** — P4 wires that at the `QuickCapture` call site.

**Files:**
- Modify: `src/features/stow/services/repository.ts`
- Modify (tests): `src/features/stow/services/repository.test.ts` *(create if absent — see note)*
- Modify: `src/features/stow/hooks/useWorkspaceData.ts`

> **Test note:** `createItemsBatch` calls Firestore (`writeBatch`/`setDoc`), which isn't exercised by pure unit tests in this repo. The contract requires the **reducer** to be unit-tested, not the repo write. We add a **lightweight payload-shape unit test** for `createItemsBatch` that mocks the `firebase/firestore` module so we can assert the per-item document body matches `createItem` defaults (kind `item`, `isPacked false`, `photoStatus`/`entryMode` derived, `createdBy`/`updatedBy`). If P1/P2 already established a repo test harness with this mock, append there; otherwise create `repository.test.ts` with the mock below. If mocking the Firestore module proves brittle, downgrade this to manual verification via the Playwright batch-commit assertion in Task 9 and skip Steps 1–2 here (note it in the commit body).

- [ ] **Step 1: Write the failing payload test** — `src/features/stow/services/repository.test.ts`.

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

// Capture writeBatch.set payloads without a live Firestore.
const setCalls: Array<{ payload: Record<string, unknown> }> = [];

vi.mock("firebase/firestore", () => {
  let autoId = 0;
  return {
    collection: () => ({ __type: "collection" }),
    doc: (_col: unknown, id?: string) => ({ id: id ?? `auto-${++autoId}` }),
    serverTimestamp: () => "__ts__",
    writeBatch: () => ({
      set: (ref: { id: string }, payload: Record<string, unknown>) => {
        setCalls.push({ payload });
      },
      commit: vi.fn(async () => undefined)
    }),
    // Unused-but-imported symbols in repository.ts must exist as no-ops:
    addDoc: vi.fn(), arrayRemove: vi.fn(), arrayUnion: vi.fn(), collectionGroup: vi.fn(),
    deleteDoc: vi.fn(), getDocs: vi.fn(), onSnapshot: vi.fn(), orderBy: vi.fn(),
    query: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(), where: vi.fn()
  };
});

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/functions", () => ({
  removeHouseholdMember: vi.fn(), revokeHouseholdInvite: vi.fn(), updateHouseholdMemberRole: vi.fn()
}));

import { inventoryRepository } from "@/features/stow/services/repository";

afterEach(() => {
  setCalls.length = 0;
});

describe("createItemsBatch", () => {
  it("writes one doc per item with createItem defaults and returns ids", async () => {
    const ids = await inventoryRepository.createItemsBatch({
      householdId: "h1",
      userId: "u1",
      items: [
        { name: "Keyboard", spaceId: "s1", areaId: "a1", areaNameSnapshot: "Desk", value: 140, tags: ["Tech"] },
        { name: "Box", spaceId: "s1", areaId: "a1", areaNameSnapshot: "Desk" }
      ]
    });

    expect(ids).toHaveLength(2);
    expect(setCalls).toHaveLength(2);

    const first = setCalls[0].payload;
    expect(first).toMatchObject({
      householdId: "h1",
      spaceId: "s1",
      areaId: "a1",
      areaNameSnapshot: "Desk",
      name: "Keyboard",
      kind: "item",
      isPacked: false,
      value: 140,
      tags: ["Tech"],
      createdBy: "u1",
      updatedBy: "u1"
    });
    // derived metadata + null defaults from createItem parity
    expect(first.entryMode).toBeDefined();
    expect(first.photoStatus).toBeDefined();

    const second = setCalls[1].payload;
    expect(second).toMatchObject({ name: "Box", value: null, tags: [], image: null, notes: "" });
  });

  it("returns an empty array for an empty items list", async () => {
    const ids = await inventoryRepository.createItemsBatch({ householdId: "h1", userId: "u1", items: [] });
    expect(ids).toEqual([]);
    expect(setCalls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/services/repository.test.ts`
Expected: FAIL — `createItemsBatch` is not a function on `inventoryRepository`.

- [ ] **Step 3: Add `NewBatchItem` + `createItemsBatch`** — `src/features/stow/services/repository.ts`.

Add the exported interface near the top (after the `SnapshotState` type), contract §5.2 verbatim:
```ts
export interface NewBatchItem {
  name: string;
  spaceId: string;
  areaId: string;
  areaNameSnapshot: string;
  image?: ImageRef;
  value?: number;
  tags?: string[];
  notes?: string;
  vision?: Item["vision"];
}
```
Add the method to the `inventoryRepository` object (place it right after `createItem` so the defaults stay visually paired):
```ts
  async createItemsBatch(input: {
    householdId: string;
    userId: string;
    items: NewBatchItem[];
  }): Promise<string[]> {
    if (input.items.length === 0) return [];
    const database = requireDb();
    const batch = writeBatch(database);
    const ids: string[] = [];
    for (const item of input.items) {
      const itemRef = doc(collection(database, householdPaths.items(input.householdId)));
      ids.push(itemRef.id);
      // Mirrors createItem() defaults exactly (kind "item", isPacked false,
      // photoStatus/entryMode derived, createdBy/updatedBy = userId).
      // NOTE: activity logging is intentionally NOT done here — P4 wires
      // logActivity(items_added_batch, count) at the QuickCapture call site.
      batch.set(itemRef, {
        householdId: input.householdId,
        spaceId: item.spaceId,
        areaId: item.areaId,
        areaNameSnapshot: item.areaNameSnapshot,
        name: item.name,
        kind: "item",
        image: item.image ?? null,
        value: item.value ?? null,
        isPriceless: false,
        tags: item.tags ?? [],
        notes: item.notes ?? "",
        isPacked: false,
        photoStatus: defaultPhotoStatus({ image: item.image }),
        entryMode: defaultEntryMode({ vision: item.vision }),
        vision: item.vision ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: input.userId,
        updatedBy: input.userId
      });
    }
    await batch.commit();
    return ids;
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/services/repository.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Expose the action in `useWorkspaceData`** — contract §6.2.

In `src/features/stow/hooks/useWorkspaceData.ts`, add to the `WorkspaceActions` type (after `createItem`):
```ts
  createItemsBatch: typeof inventoryRepository.createItemsBatch;
```
And add to the `actions` memo object (after `createItem: inventoryRepository.createItem,`):
```ts
      createItemsBatch: inventoryRepository.createItemsBatch,
```

- [ ] **Step 6: Typecheck + run the client suite**

Run: `npm run typecheck && npx vitest run src/features/stow/services/repository.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/stow/services/repository.ts src/features/stow/services/repository.test.ts src/features/stow/hooks/useWorkspaceData.ts
git commit -m "feat(mobile): add createItemsBatch repo method and workspace action"
```

---

## Task 6: `captureReducer` — pure review-state machine (EXHAUSTIVE tests)

The heart of P3. A pure reducer drives the QuickCapture review flow (contract §9.3). It computes the least-confident-first review order, holds per-detection drafts, advances a cursor on confirm/skip, supports rename, retargets the destination, and projects kept drafts to `NewBatchItem[]` via `selectCommitItems`.

**Files:**
- Create: `src/features/stow/ui/mobile/capture/captureReducer.ts`
- Create (tests): `src/features/stow/ui/mobile/capture/captureReducer.test.ts`

**Design decisions (locked for this plan):**
- `order = detections.map((_, i) => i).sort((a, b) => conf[a] - conf[b])` — a **stable** ascending-confidence sort. JS `Array.prototype.sort` is stable (ES2019+), so equal confidences keep detection order. (Test asserts this.)
- `drafts` is keyed by **detection index** (not the position in `order`). Each draft starts `{ name: detection.label, keep: true, tags: detection.tags ?? [], value: detection.suggestedValue }`. An empty label (`""`, the "unknown" case) starts `keep: true` but `selectCommitItems` drops any kept draft whose trimmed name is empty (you cannot commit an unnamed item — matches the prototype's "unknown must be named first" rule).
- `confirm` sets that index's `keep: true` and advances the cursor. `skip` sets `keep: false` and advances. `rename` updates `name` for an index (does not advance). `confirm`/`skip` accept the **detection index** (the UI passes `order[cursor]`).
- `cursor` advances by 1; when `cursor` would pass the last review position, the reducer does **not** auto-transition (the UI dispatches `commitReady` when `cursor >= order.length`, or the user taps Done). Keep the reducer free of side effects; phase transitions are explicit actions.
- Phases: `analyzing` (initial) → `detected` (on `detected` action) → `review` (on `startReview`) → `destination` (optional retarget surface; `setDestination` may fire from any phase and does not change `phase`) → `done` (on `commitReady`). `setDestination` only mutates `destination`. The dedicated `destination` phase value exists for the UI's full-screen picker; transitions into it are the UI's concern (it can render the picker as an overlay without changing `phase`), so the reducer treats `destination` as a settable phase only if a future action needs it — for P3 we drive the picker as an overlay and never set `phase: "destination"`. We keep the phase in the union for contract compliance and forward-compat.

> The contract's `CaptureAction` union has no explicit "set phase to destination" action; the picker is an inline overlay (as in the prototype). `setDestination` updates the destination and the UI closes the picker. This keeps the reducer minimal and fully tested.

- [ ] **Step 1: Write the failing tests** — `src/features/stow/ui/mobile/capture/captureReducer.test.ts`.

```ts
import { describe, expect, it } from "vitest";
import {
  captureReducer,
  initialCaptureState,
  selectCommitItems,
  type CaptureState
} from "@/features/stow/ui/mobile/capture/captureReducer";
import type { ShelfDetection } from "@/types/llm";

const dest = { spaceId: "s1", areaId: "a1", areaNameSnapshot: "Desk" };

const DETS: ShelfDetection[] = [
  { label: "Keyboard", confidence: 0.97, bbox: [0.1, 0.15, 0.45, 0.29], suggestedValue: 140, tags: ["Tech", "Work"] },
  { label: "Headphones", confidence: 0.61, bbox: [0.63, 0.19, 0.27, 0.23], tags: ["Audio"] },
  { label: "", confidence: 0.44, bbox: [0.09, 0.7, 0.26, 0.17] } // unknown
];

function seeded(): CaptureState {
  let s = initialCaptureState(dest);
  s = captureReducer(s, { type: "detected", detections: DETS });
  return s;
}

describe("captureReducer — setup", () => {
  it("starts in analyzing with the provided destination", () => {
    const s = initialCaptureState(dest);
    expect(s.phase).toBe("analyzing");
    expect(s.destination).toEqual(dest);
    expect(s.detections).toEqual([]);
    expect(s.order).toEqual([]);
    expect(s.cursor).toBe(0);
  });

  it("'detected' stores detections, moves to detected phase, and seeds drafts from labels", () => {
    const s = seeded();
    expect(s.phase).toBe("detected");
    expect(s.detections).toHaveLength(3);
    expect(s.drafts[0]).toEqual({ name: "Keyboard", keep: true, tags: ["Tech", "Work"], value: 140 });
    expect(s.drafts[1]).toEqual({ name: "Headphones", keep: true, tags: ["Audio"], value: undefined });
    expect(s.drafts[2]).toEqual({ name: "", keep: true, tags: [], value: undefined });
  });

  it("orders review least-confident-first (stable for ties)", () => {
    const s = seeded();
    // confidences: idx0=0.97, idx1=0.61, idx2=0.44 -> order [2,1,0]
    expect(s.order).toEqual([2, 1, 0]);
  });

  it("keeps original index order for equal confidences (stable sort)", () => {
    const ties: ShelfDetection[] = [
      { label: "A", confidence: 0.5, bbox: [0, 0, 1, 1] },
      { label: "B", confidence: 0.5, bbox: [0, 0, 1, 1] },
      { label: "C", confidence: 0.2, bbox: [0, 0, 1, 1] }
    ];
    let s = initialCaptureState(dest);
    s = captureReducer(s, { type: "detected", detections: ties });
    expect(s.order).toEqual([2, 0, 1]);
  });
});

describe("captureReducer — review transitions", () => {
  it("'startReview' moves to review phase at cursor 0", () => {
    const s = captureReducer(seeded(), { type: "startReview" });
    expect(s.phase).toBe("review");
    expect(s.cursor).toBe(0);
  });

  it("'rename' updates the draft name for a detection index without advancing", () => {
    let s = captureReducer(seeded(), { type: "startReview" });
    s = captureReducer(s, { type: "rename", index: 2, name: "Earbuds" });
    expect(s.drafts[2].name).toBe("Earbuds");
    expect(s.cursor).toBe(0);
  });

  it("'confirm' marks keep=true and advances the cursor", () => {
    let s = captureReducer(seeded(), { type: "startReview" });
    // order is [2,1,0]; first reviewed is index 2
    s = captureReducer(s, { type: "confirm", index: 2 });
    expect(s.drafts[2].keep).toBe(true);
    expect(s.cursor).toBe(1);
  });

  it("'skip' marks keep=false and advances the cursor", () => {
    let s = captureReducer(seeded(), { type: "startReview" });
    s = captureReducer(s, { type: "skip", index: 2 });
    expect(s.drafts[2].keep).toBe(false);
    expect(s.cursor).toBe(1);
  });

  it("cursor does not advance past order.length", () => {
    let s = captureReducer(seeded(), { type: "startReview" });
    s = captureReducer(s, { type: "confirm", index: 2 }); // cursor 1
    s = captureReducer(s, { type: "skip", index: 1 });    // cursor 2
    s = captureReducer(s, { type: "confirm", index: 0 }); // cursor would be 3 -> clamp at 3 (== length)
    expect(s.cursor).toBe(3);
    // a further confirm is a no-op on cursor (defensive)
    const s2 = captureReducer(s, { type: "confirm", index: 0 });
    expect(s2.cursor).toBe(3);
  });
});

describe("captureReducer — destination + commit", () => {
  it("'setDestination' retargets without changing phase", () => {
    let s = captureReducer(seeded(), { type: "startReview" });
    const next = { spaceId: "s2", areaId: "a9", areaNameSnapshot: "Garage" };
    s = captureReducer(s, { type: "setDestination", destination: next });
    expect(s.destination).toEqual(next);
    expect(s.phase).toBe("review");
  });

  it("'commitReady' moves to done", () => {
    const s = captureReducer(seeded(), { type: "commitReady" });
    expect(s.phase).toBe("done");
  });
});

describe("selectCommitItems", () => {
  it("projects kept, named drafts to NewBatchItem[] using the current destination", () => {
    let s = captureReducer(seeded(), { type: "startReview" });
    s = captureReducer(s, { type: "confirm", index: 2 });  // unknown, still unnamed -> dropped
    s = captureReducer(s, { type: "skip", index: 1 });      // headphones skipped
    s = captureReducer(s, { type: "confirm", index: 0 });   // keyboard kept
    const items = selectCommitItems(s);
    expect(items).toEqual([
      {
        name: "Keyboard",
        spaceId: "s1",
        areaId: "a1",
        areaNameSnapshot: "Desk",
        value: 140,
        tags: ["Tech", "Work"]
      }
    ]);
  });

  it("includes a renamed unknown once it has a name", () => {
    let s = captureReducer(seeded(), { type: "startReview" });
    s = captureReducer(s, { type: "rename", index: 2, name: "Earbuds" });
    s = captureReducer(s, { type: "confirm", index: 2 });
    s = captureReducer(s, { type: "skip", index: 1 });
    s = captureReducer(s, { type: "skip", index: 0 });
    const items = selectCommitItems(s);
    expect(items.map((i) => i.name)).toEqual(["Earbuds"]);
  });

  it("trims names and drops drafts that are kept but blank", () => {
    let s = captureReducer(seeded(), { type: "startReview" });
    s = captureReducer(s, { type: "rename", index: 0, name: "  Spaced Keyboard  " });
    s = captureReducer(s, { type: "confirm", index: 0 });
    s = captureReducer(s, { type: "rename", index: 1, name: "   " }); // blank
    s = captureReducer(s, { type: "confirm", index: 1 });
    s = captureReducer(s, { type: "skip", index: 2 });
    const items = selectCommitItems(s);
    expect(items.map((i) => i.name)).toEqual(["Spaced Keyboard"]);
  });

  it("omits value/tags when absent (no value, empty tags array stays empty)", () => {
    const dets: ShelfDetection[] = [{ label: "Box", confidence: 0.5, bbox: [0, 0, 1, 1] }];
    let s = initialCaptureState(dest);
    s = captureReducer(s, { type: "detected", detections: dets });
    s = captureReducer(s, { type: "startReview" });
    s = captureReducer(s, { type: "confirm", index: 0 });
    const items = selectCommitItems(s);
    expect(items[0]).toEqual({ name: "Box", spaceId: "s1", areaId: "a1", areaNameSnapshot: "Desk", tags: [] });
    expect(items[0]).not.toHaveProperty("value");
  });

  it("returns [] when nothing is kept", () => {
    let s = captureReducer(seeded(), { type: "startReview" });
    s = captureReducer(s, { type: "skip", index: 2 });
    s = captureReducer(s, { type: "skip", index: 1 });
    s = captureReducer(s, { type: "skip", index: 0 });
    expect(selectCommitItems(s)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/stow/ui/mobile/capture/captureReducer.test.ts`
Expected: FAIL — import cannot be resolved.

- [ ] **Step 3: Write the implementation** — `src/features/stow/ui/mobile/capture/captureReducer.ts`.

```ts
import type { ShelfDetection } from "@/types/llm";
import type { NewBatchItem } from "@/features/stow/services/repository";

export type CapturePhase = "analyzing" | "detected" | "review" | "destination" | "done";

export interface CaptureDraft {
  name: string;
  keep: boolean;
  tags: string[];
  value?: number;
}

export interface CaptureDestination {
  spaceId: string | null;
  areaId: string | null;
  areaNameSnapshot: string;
}

export interface CaptureState {
  phase: CapturePhase;
  detections: ShelfDetection[];
  order: number[]; // review order = detection indices, least-confident-first
  cursor: number; // position within `order`
  drafts: Record<number, CaptureDraft>; // keyed by detection index
  destination: CaptureDestination;
}

export type CaptureAction =
  | { type: "detected"; detections: ShelfDetection[] }
  | { type: "startReview" }
  | { type: "rename"; index: number; name: string }
  | { type: "confirm"; index: number }
  | { type: "skip"; index: number }
  | { type: "setDestination"; destination: CaptureDestination }
  | { type: "commitReady" };

export function initialCaptureState(destination: CaptureDestination): CaptureState {
  return {
    phase: "analyzing",
    detections: [],
    order: [],
    cursor: 0,
    drafts: {},
    destination
  };
}

function buildOrder(detections: ShelfDetection[]): number[] {
  // Stable ascending-confidence sort (least sure first). Array.sort is stable in ES2019+.
  return detections
    .map((_, i) => i)
    .sort((a, b) => detections[a].confidence - detections[b].confidence);
}

function buildDrafts(detections: ShelfDetection[]): Record<number, CaptureDraft> {
  const drafts: Record<number, CaptureDraft> = {};
  detections.forEach((d, i) => {
    drafts[i] = {
      name: d.label,
      keep: true,
      tags: d.tags ? [...d.tags] : [],
      value: d.suggestedValue
    };
  });
  return drafts;
}

export function captureReducer(state: CaptureState, action: CaptureAction): CaptureState {
  switch (action.type) {
    case "detected":
      return {
        ...state,
        phase: "detected",
        detections: action.detections,
        order: buildOrder(action.detections),
        cursor: 0,
        drafts: buildDrafts(action.detections)
      };
    case "startReview":
      return { ...state, phase: "review", cursor: 0 };
    case "rename": {
      const existing = state.drafts[action.index];
      if (!existing) return state;
      return {
        ...state,
        drafts: { ...state.drafts, [action.index]: { ...existing, name: action.name } }
      };
    }
    case "confirm":
    case "skip": {
      const existing = state.drafts[action.index];
      const keep = action.type === "confirm";
      const drafts = existing
        ? { ...state.drafts, [action.index]: { ...existing, keep } }
        : state.drafts;
      return { ...state, drafts, cursor: Math.min(state.cursor + 1, state.order.length) };
    }
    case "setDestination":
      return { ...state, destination: action.destination };
    case "commitReady":
      return { ...state, phase: "done" };
    default:
      return state;
  }
}

export function selectCommitItems(state: CaptureState): NewBatchItem[] {
  const items: NewBatchItem[] = [];
  state.detections.forEach((_detection, index) => {
    const draft = state.drafts[index];
    if (!draft || !draft.keep) return;
    const name = draft.name.trim();
    if (!name) return; // cannot commit an unnamed item
    items.push({
      name,
      spaceId: state.destination.spaceId ?? "",
      areaId: state.destination.areaId ?? "",
      areaNameSnapshot: state.destination.areaNameSnapshot,
      tags: draft.tags,
      ...(typeof draft.value === "number" ? { value: draft.value } : {})
    });
  });
  return items;
}
```

> Iterating `state.detections.forEach` (not `order`) in `selectCommitItems` yields kept items in **original detection order** for a tidy Done summary; the review *order* is least-confident-first but the committed list reads top-to-bottom as photographed.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/stow/ui/mobile/capture/captureReducer.test.ts`
Expected: PASS (all groups).

- [ ] **Step 5: Typecheck (cross-module `NewBatchItem` import)**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/stow/ui/mobile/capture/captureReducer.ts src/features/stow/ui/mobile/capture/captureReducer.test.ts
git commit -m "feat(mobile): add captureReducer with least-confident-first review"
```

---

## Task 7: `QuickCapture.tsx` — review-stack UI bound to the reducer

Port the prototype `QuickCapture` (`docs/superpowers/design-reference/prototype/quick-capture.jsx`) to a live component driven by `captureReducer`. It uploads the frozen frame, calls `visionDetectShelfItems`, renders confidence-coded boxes over the still, runs the least-confident-first review stack, offers a retargetable destination, and commits via `createItemsBatch` on Done.

**Files:**
- Create: `src/features/stow/ui/mobile/capture/QuickCapture.tsx`

**Prop interface** (contract §9.3):
```ts
interface QuickCaptureProps {
  householdId: string;
  spaceId?: string;
  areaId?: string;
  onClose: () => void;
  onCommitted: (count: number) => void;
}
```

**Data wiring & dependencies it consumes:**
- `useWorkspaceData(householdId, user)` — needs `spaces` (`SpaceWithAreas[]`), `userId`, and `actions.createItemsBatch`. **However** `QuickCapture` should receive what it needs as props from `StowMobileApp` rather than re-subscribing. Decision: pass the already-available data down. The component signature stays per-contract (`householdId/spaceId/areaId/onClose/onCommitted`); it additionally pulls live data through a thin internal hook call `useWorkspaceData` is **not** re-invoked — instead `StowMobileApp` (Task 8 wiring) renders `<QuickCapture>` inside a small adapter that supplies `spaces`, `userId`, and `createItemsBatch`. To keep the contract prop shape exact, add these as a second props group typed `QuickCaptureDeps` *(see note)*.

> **Wiring note (avoid prop bloat vs contract):** The contract fixes the 5-prop public shape. To keep that exact while giving the component live data, define `QuickCapture` to accept exactly the contract props and obtain data via the module's shared hook: call `useWorkspaceData(householdId, /* user */ null-safe)` is **not** possible (needs `User`). Therefore `StowMobileApp` passes the data via React context already established in P1 (the mobile app provides a `WorkspaceContext`), OR, if no such context exists, `QuickCapture` accepts an extra `deps` prop. **Pick the approach P1/P2 used for other overlays** (e.g. how `CaptureFirst` got `spaces`/`createItem`). Mirror that. If P2's `CaptureFirst` took data as props, `QuickCapture` takes `spaces`, `userId`, and `createItemsBatch` as additional props (documented here as `QuickCaptureProps & QuickCaptureData`). Do not re-subscribe Firestore inside the overlay.

For this plan, assume the P2 pattern is **props** (matching `CaptureFirst` in the contract §9 signature, which takes `householdId/spaceId/areaId/onClose/onCreated` and reads data from props/context). Implement:
```ts
interface QuickCaptureData {
  spaces: SpaceWithAreas[];
  userId: string;
  createItemsBatch: (input: {
    householdId: string; userId: string; items: NewBatchItem[];
  }) => Promise<string[]>;
  detectShelfItems?: typeof visionDetectShelfItems; // injectable for tests; defaults to the real wrapper
  uploadFrame?: (blob: Blob) => Promise<ImageRef>;   // injectable; defaults to uploadFileToStorage into items path
  capturedBlob: Blob;                                 // the frozen frame handed in by ScanOverlay
  capturedPreviewUrl: string;                         // object URL for the frozen frame (for box overlay background)
}
export function QuickCapture(props: QuickCaptureProps & QuickCaptureData): JSX.Element;
```

**Phase structure** (driven by `captureReducer`; `useReducer(captureReducer, initialCaptureState(initialDest))`):
1. **`analyzing`** — render the frozen frame (`capturedPreviewUrl`) dimmed with corner brackets + `capSweep` band + "Analyzing frame" chip + honest footer "One still frame, read on-device — not live video." On mount of this phase: `uploadFrame(capturedBlob)` → `visionDetectShelfItems({ householdId, imageRef: { storagePath }, spaceId, areaId, areaName })` → on success `dispatch({ type: "detected", detections })`; on error show an inline error with Retry/Close (no crash). Guard with an `useRef` so the effect fires once per analyze attempt.
2. **`detected`** — same frozen frame, now with **confidence-coded boxes** (see treatment below), a "{n} found · {low} need a look" chip, and Rescan / "Review {n} items" buttons. "Review" → `dispatch({ type: "startReview" })`. "Rescan" resets to `analyzing` (re-runs detection on the same frame, or closes back to `ScanOverlay` — for P3, re-run detection on the same `capturedBlob`).
3. **`review`** — the card stack. Current detection = `state.order[state.cursor]`. Show: image crop/preview, Confident vs Low-confidence badge, `{pct}% match` bar (pct = `Math.round(confidence*100)`), name treatment:
   - **unknown** (`detection.label === ""`): amber "Couldn't identify — name it or skip" + autofocus text input bound to `dispatch(rename)`.
   - **low** (`confidence < 0.6`): "Best guess — confirm which" + ranked-guess chips. Source of guesses: the detection has no `guesses` field in our domain, so render `[detection.label]` plus the two generic fallbacks `["Something else"]` — i.e. a single primary chip (the label) and an "Other → rename" chip that flips to the rename input. (Prototype had hand-authored guesses; live data only has one label, so the chip row is `[label]` selected by default + a "Something else" chip that opens rename.)
   - **confident** (`>= 0.6`): show the name; a Rename toggle reveals an input.
   - Destination pill (accent) opens the inline destination picker overlay; selecting an area dispatches `setDestination`.
   - Triage row: **Skip** (`dispatch skip(index)`), **Confirm & add** (`dispatch confirm(index)`; if the name is blank, open rename instead of advancing — mirror the prototype `confirm()` guard), **Rename** toggle. After the action that advances past the last card (`cursor >= order.length`), `dispatch({ type: "commitReady" })` to land on `done`.
   - Progress dots reflect `order` with `cursor`.
4. **`destination`** — not used as a `phase`; the picker is an inline overlay (state-local `pickerOpen` boolean) rendered above the review card, listing `spaces` → areas as chips. (Matches the prototype.)
5. **`done`** — success summary: "{kept} item(s) filed" + destination line + a row per kept item (from `selectCommitItems(state)`), skipped count. The **Done button** calls:
   ```ts
   const items = selectCommitItems(state);
   await createItemsBatch({ householdId, userId, items });
   onCommitted(items.length);
   // P4: logActivity({ type: "items_added_batch", count: items.length, ... }) is wired HERE.
   ```
   Disable the button while committing; on error show inline retry. After success, `onCommitted` lets `StowMobileApp` close the overlay + toast "Added {n} items".

**Confidence-box treatment (contract §9.3):**
- Box border: `confidence >= 0.6` → `2.5px solid var(--stow-accent)`; else `2.5px dashed #C9821F` (amber). Define `const AMBER = "#C9821F";` locally.
- Box position from `bbox:[x,y,w,h]` (0..1): `style={{ left: \`${x*100}%\`, top: \`${y*100}%\`, width: \`${w*100}%\`, height: \`${h*100}%\` }}` over a `position:relative` frame container that matches the displayed image's box (object-fit cover; acceptable for P3 — boxes are indicative).
- Label pill background = the same accent/amber color; low-confidence shows a `HelpCircle` glyph and `?` instead of the name, with `{pct}%`.

**Token translation (contract §1.3):** translate prototype `P.x`/`St.x` → `var(--stow-x)` (`P.accent`→`var(--stow-accent)`, `P.canvas`→`var(--stow-canvas)`, `P.surface`→`var(--stow-surface)`, `P.ink`/`inkMuted`/`inkSoft`/`warm`/`border`/`borderL`→ the matching `--stow-*`, `P.accentSoft`→`var(--stow-accent-soft)`, `P.success`/`successSoft`→ matching vars, `P.shadow`/`shadowSoft`→ matching vars; `P.radius + 2`→`var(--stow-radius-input)`, bare radii per §1.3). Alpha tints like `P.accent + "55"` → `color-mix(in srgb, var(--stow-accent) 33%, transparent)`. Icons come from `@/features/stow/ui/mobile/theme/icons` (`X`, `Check`, `ScanLine`, `Camera`, `MapPin`, `ChevronRight`, plus add `HelpCircle`, `AlertTriangle`, `RotateCcw`, `ArrowRight`, `Sparkles`, `Grid`, `ChevronDown`, `Edit`/`Pencil`, `DollarSign`, `Tag` to the icon re-exports if missing — extend `theme/icons.tsx` in this task as needed; they are all real lucide-react names). Fonts: the Done `<h1>` uses `fontFamily: "var(--stow-display)"`; body inherits `--stow-body`. **Camera/scan dark** background stays the literal `#0A0A12` per spec §5.1.

**Prototype → domain mapping (contract §11):** prototype `DETECTED[].box{top,left,w,h}` → live `bbox:[x,y,w,h]`; prototype `d.img` (per-detection thumbnail) does not exist in live detection — render a crop of the frozen frame positioned by `bbox`, or the frozen frame thumbnail, as the review-card image; prototype `dest.roomId/area` → `destination.spaceId` + `areaNameSnapshot` (resolve room color/name from `spaces`); prototype `act.commitCapture(newItems)` → `createItemsBatch` + `onCommitted`.

- [ ] **Step 1: Extend icon re-exports if needed** — `src/features/stow/ui/mobile/theme/icons.tsx`.

Add any missing glyphs to the import + re-export block (only those not already exported by P0/P1): `HelpCircle`, `AlertTriangle`, `RotateCcw`, `ArrowRight`, `Sparkles`, `Grid3x3` (export as `Grid`), `ChevronDown`, `Pencil` (already present), `DollarSign`, `Tag` (present), `Camera` (present). Run `npm run typecheck` after; if any lucide name errors, swap per the P0 note (`node -e "console.log(Object.keys(require('lucide-react')))"`).

- [ ] **Step 2: Write the component** — port the prototype function into `QuickCapture.tsx`.

Implement the structure above:
- `useReducer(captureReducer, undefined, () => initialCaptureState(resolveInitialDest(spaces, spaceId, areaId)))` where `resolveInitialDest` finds the space by `spaceId` (fallback first space), and the area by `areaId` (fallback first area of that space), returning `{ spaceId, areaId, areaNameSnapshot }`.
- An analyze `useEffect` keyed on `phase === "analyzing"` guarded by a ref, calling `uploadFrame` (default: `uploadFileToStorage(storagePaths.itemImage(householdId, "_shelf", \`${Date.now()}.jpg\`), new File([capturedBlob], "shelf.jpg", { type: "image/jpeg" }))` — note: shelf frames go under a stable `_shelf` pseudo-item folder; cleanup of these is best-effort/out of scope for P3) then `detectShelfItems`.
- Render per phase. For `review`, derive `current = state.order[state.cursor]`, `det = state.detections[current]`, `draft = state.drafts[current]`, `pct = Math.round(det.confidence * 100)`, `low = det.confidence < 0.6`, `unknown = det.label === ""`.
- Destination picker overlay (local `pickerOpen`) lists `spaces.map(space => space.areas.map(area => chip))`; select → `dispatch({ type: "setDestination", destination: { spaceId: space.id, areaId: area.id, areaNameSnapshot: area.name } })` then `setPickerOpen(false)`.
- Confirm handler:
  ```ts
  function onConfirm() {
    const name = state.drafts[current]?.name.trim() ?? "";
    if (!name) { setRenaming(true); return; }
    const next = captureReducer(state, { type: "confirm", index: current });
    if (next.cursor >= next.order.length) dispatch({ type: "commitReady" });
    else dispatch({ type: "confirm", index: current });
  }
  ```
  (Equivalently dispatch confirm, then in an effect detect `cursor >= order.length` and dispatch `commitReady`. Choose the effect approach to avoid double-dispatch; keep it simple and correct.)
- Done handler commits via `createItemsBatch` (await, guard with `committing` state) then `onCommitted(items.length)`.

Then add the closing instruction in the code comment:
> Port markup section-by-section from `prototype/quick-capture.jsx` `QuickCapture` (analyzing/detected frozen-frame block, review card + triage row, done summary), translating per contract §1.3 and swapping mock data per contract §11. Do not ship any Unsplash URLs (`FEED`, `DETECTED[].img`) — use the live frozen frame.

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS. (No unit test — UI is validated by Playwright in Task 9 and manual load.)

- [ ] **Step 4: Commit**

```bash
git add src/features/stow/ui/mobile/capture/QuickCapture.tsx src/features/stow/ui/mobile/theme/icons.tsx
git commit -m "feat(mobile): add QuickCapture shelf review stack bound to reducer"
```

---

## Task 8: Wire `ScanOverlay` "Whole shelf" → `QuickCapture`

P2 shipped `ScanOverlay` with an `onCaptureShelf?: (blob: Blob) => void` hook (contract §9). Wire it so that capturing in "Whole shelf" mode hands the frozen frame to `QuickCapture` (rendered by `StowMobileApp` as a top overlay, z-index 90 per the contract ladder).

**Files:**
- Modify: `src/features/stow/ui/mobile/StowMobileApp.tsx`
- Modify: `src/features/stow/ui/mobile/capture/ScanOverlay.tsx` *(only if `onCaptureShelf` is not yet invoked on shelf-mode shutter — confirm P2 wired the shutter to call it; if P2 left it as a stub, complete the invocation)*

- [ ] **Step 1: Confirm/complete the `ScanOverlay` shelf shutter**

Read `src/features/stow/ui/mobile/capture/ScanOverlay.tsx`. The prototype's shelf shutter calls `act.startQuickCapture`; our P2 contract maps that to `onCaptureShelf`. Ensure: in shelf mode, the shutter calls `props.onCaptureShelf?.(blob)` with the frozen frame blob from `useCamera().capture()` (or the file-input fallback File coerced to Blob). If P2 already did this, no change. If P2 only wired single mode (`onCaptureSingle`), add the shelf-mode branch mirroring it.

- [ ] **Step 2: Render `QuickCapture` from `StowMobileApp`**

In `StowMobileApp.tsx`, add local state for the shelf capture session:
```ts
const [shelfCapture, setShelfCapture] = useState<{ blob: Blob; previewUrl: string } | null>(null);
```
Where `ScanOverlay` is rendered (the `scan` overlay branch from `useMobileNavigation`), pass:
```tsx
<ScanOverlay
  onClose={nav.closeOverlay}
  onCaptureSingle={/* existing P2 handler */}
  onCaptureShelf={(blob) => {
    setShelfCapture({ blob, previewUrl: URL.createObjectURL(blob) });
    nav.closeOverlay(); // close the viewfinder; QuickCapture takes over
  }}
/>
```
Then render `QuickCapture` when `shelfCapture` is set, supplying live data (the props per Task 7's wiring decision):
```tsx
{shelfCapture ? (
  <QuickCapture
    householdId={householdId}
    spaceId={nav.selectedSpaceId ?? undefined}
    areaId={nav.selectedAreaId ?? undefined}
    spaces={data.spaces}
    userId={data.userId ?? ""}
    createItemsBatch={data.actions.createItemsBatch}
    capturedBlob={shelfCapture.blob}
    capturedPreviewUrl={shelfCapture.previewUrl}
    onClose={() => {
      URL.revokeObjectURL(shelfCapture.previewUrl);
      setShelfCapture(null);
    }}
    onCommitted={(count) => {
      URL.revokeObjectURL(shelfCapture.previewUrl);
      setShelfCapture(null);
      setToast(`Added ${count} item${count !== 1 ? "s" : ""}`);
    }}
  />
) : null}
```
> Use whatever toast setter `StowMobileApp` already owns (P0 used `setToast`). Revoke the object URL on both close paths to avoid leaks. `QuickCapture`'s wrapper z-index must be 90 (contract §7 ladder).

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke (dev)**

Run: `npm run dev` (with a configured/emulated household). Open `/app`, tap the scan FAB → switch to "Whole shelf" → shutter. Expect `QuickCapture` to take over (analyzing frame), then (with a real configured Gemini key, or via the Task 9 mock) detections, review, and a Done commit that adds items to the targeted area.

- [ ] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/StowMobileApp.tsx src/features/stow/ui/mobile/capture/ScanOverlay.tsx
git commit -m "feat(mobile): launch QuickCapture from ScanOverlay whole-shelf mode"
```

---

## Task 9: Playwright — whole-shelf flow with a mocked detection callable

Add an e2e spec under `tests/smoke/` that drives `/app`, opens the shelf capture flow, mocks the `visionDetectShelfItems` callable HTTP request, reviews the detections, and asserts the batch commit adds N items.

**Files:**
- Create: `tests/smoke/shelf-capture.spec.ts`

**Mocking approach:** the Firebase callable hits the Functions emulator over HTTP at a URL containing `visionDetectShelfItems`. Intercept with `page.route("**/visionDetectShelfItems**", …)` and fulfill with the callable envelope `{ data: { detections, provider, jobId } }` (httpsCallable expects a top-level `data` key). Detections use **bbox 0..1**. This avoids needing a real Gemini key and keeps the test deterministic. Image upload to the Storage emulator still happens (the storage emulator is in the `test:smoke` emulator set); if upload flakiness appears, also stub `uploadFrame` is not possible from Playwright — instead rely on the storage emulator (already used by `authenticated-smoke.spec.ts` with PNG bytes) and the small camera fallback (file input). Use the **file-input fallback** path (no real camera in headless Chromium) — the same pattern P2's capture spec uses.

- [ ] **Step 1: Write the spec**

```ts
import { expect, test, type Page } from "@playwright/test";

// Reuse the email sign-in helper pattern from authenticated-smoke.spec.ts.
// (Import or duplicate signIn() + waitForEmailLink() — match that file's helpers.)

const SHELF_DETECTIONS = {
  data: {
    detections: [
      { label: "Mechanical Keyboard", confidence: 0.97, bbox: [0.11, 0.15, 0.45, 0.29], suggestedValue: 140, tags: ["Tech"] },
      { label: "Headphones", confidence: 0.61, bbox: [0.63, 0.19, 0.27, 0.23], tags: ["Audio"] },
      { label: "", confidence: 0.44, bbox: [0.09, 0.7, 0.26, 0.17] }
    ],
    provider: "gemini",
    jobId: "job-test-1"
  }
};

async function mockShelfDetection(page: Page) {
  await page.route("**/visionDetectShelfItems**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SHELF_DETECTIONS)
    });
  });
}

test.describe("whole-shelf batch capture", () => {
  test("detects, reviews least-confident-first, and batch-commits", async ({ page }) => {
    await mockShelfDetection(page);
    await signIn(page, "shelf"); // lands on /spaces per helper; then navigate to /app

    // Ensure a space + area exist (create via the /app UI or seed). Then go to /app.
    await page.goto("/app");
    await expect(page.getByRole("navigation")).toBeVisible();

    // Open scan FAB -> Whole shelf -> shutter (file-input fallback).
    await page.getByRole("button", { name: "Scan" }).click();
    await page.getByRole("button", { name: /Whole shelf/i }).click();

    // Provide the frame via the capture file input (camera unavailable headless).
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: "shelf.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB/8AAEQgAAQABAwEiAAIRAQMRAf/EABUAAQEAAAAAAAAAAAAAAAAAAAAH/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
        "base64"
      )
    });

    // Analyzing -> detected. Assert the "found" summary and review entry.
    await expect(page.getByText(/found/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/need a look/i)).toBeVisible();
    await page.getByRole("button", { name: /Review/i }).click();

    // Review is least-confident-first: first card is the unknown (conf 0.44).
    await expect(page.getByText(/name it or skip/i)).toBeVisible();
    await page.getByPlaceholder(/Wireless Earbuds|e\.g\./i).fill("Desk Speaker");
    await page.getByRole("button", { name: /Confirm/i }).click();

    // Next: Headphones (low, 0.61) -> confirm.
    await page.getByRole("button", { name: /Confirm/i }).click();

    // Next: Keyboard (confident, 0.97) -> confirm -> lands on done.
    await page.getByRole("button", { name: /Confirm/i }).click();

    // Done summary shows 3 filed; commit.
    await expect(page.getByText(/3 items filed/i)).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    // Toast + items present. Navigate to the target area and assert the 3 names.
    await expect(page.getByText(/Added 3 items/i)).toBeVisible();
    // (Open the destination space/area and assert Keyboard/Headphones/Desk Speaker rows.)
  });
});
```

> Adjust selectors to the actual rendered labels/placeholders from Task 7. The decisive assertions are: (a) detections render after the mocked callable, (b) the **first** review card is the least-confident (unknown) one, and (c) after Done, **3** items exist in the targeted area. If creating a space/area inline is heavy, seed via the existing demo-seed or the `/app` Add flows from P1.

- [ ] **Step 2: Run the smoke spec**

Run: `npm run test:smoke -- --grep "whole-shelf"` *(uses the auth+firestore+storage emulators; the detection callable is mocked via `page.route`, so the functions emulator is not required)*
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/shelf-capture.spec.ts
git commit -m "test(mobile): e2e whole-shelf batch capture with mocked detection"
```

---

## Task 10: Full verification

- [ ] **Step 1: Functions tests**

Run: `npm run functions:test`
Expected: PASS (schemas + gemini mapping).

- [ ] **Step 2: Client unit suite**

Run: `npm test`
Expected: PASS, including `captureReducer.test.ts` and `repository.test.ts`.

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both succeed (TS project build + Vite production build). Confirm `functions` build too: `npm run functions:build`.

- [ ] **Step 4: Smoke (optional pre-merge)**

Run: `npm run test:smoke -- --grep "whole-shelf"`
Expected: PASS.

- [ ] **Step 5: Final commit (only if manual fixups were needed)**

```bash
git add -A
git commit -m "chore(mobile): P3 whole-shelf batch capture verified"
```

---

## Self-review (P3 plan vs roadmap tasks + contract sections)

**Roadmap P3 tasks (roadmap "P3" section, tasks 1–7):**
- (1) Schemas + tests → **Task 1** (`visionDetectShelfInputSchema`/`shelfDetectionSchema`/`visionDetectShelfResultSchema` + `functions/test/schemas.test.ts`). ✓
- (2) Gemini multi-object provider + test (mock API → mapped detections) → **Task 2** (`detectShelfItems` on the interface + Gemini impl + `box_2d` 0..1000 → `bbox` 0..1 mapping; `functions/test/gemini.test.ts`). ✓
- (3) `visionDetectShelfItems` callable + client wrapper → **Task 3** (`visionDetectShelfItemsHandler` + `index.ts` `onCall`) and **Task 4** (`src/lib/firebase/functions.ts` wrapper + `src/types/llm.ts`). ✓
- (4) `captureReducer` tested thoroughly (ordering, triage, retarget, commit payload) → **Task 6** (exhaustive `captureReducer.test.ts`: setup/order/stable-ties, rename/confirm/skip transitions + cursor clamp, `setDestination`, `commitReady`, `selectCommitItems` projection incl. unknown-drop, trim, value/tags omission, empty). ✓
- (5) `QuickCapture` UI bound to reducer → **Task 7** (prop interface, phase structure analyzing→detected→review→done with inline destination picker, confidence-coded boxes, ranked-guess/match-%, port instruction). ✓
- (6) `createItemsBatch` + activity → **Task 5** (`createItemsBatch` + `useWorkspaceData` action). Activity is **P4** per contract §5.2/§9.3 — call site marked, not implemented. ✓ (intentional deviation, documented)
- (7) Honest UX copy + confidence treatment → **Task 7** ("One still frame, read on-device — not live video"; solid accent ≥0.6 / dashed amber `#C9821F`; "{low} need a look"). ✓
- `ScanOverlay` "Whole shelf" → QuickCapture (roadmap "Frontend additions") → **Task 8** (wire P2 `onCaptureShelf`). ✓
- Playwright with mocked callable (roadmap Tests) → **Task 9**. ✓

**Contract sections:**
- **§4 (P3 `src/types/llm.ts`)** — `ShelfDetection`, `VisionDetectShelfRequest`, `VisionDetectShelfResponse` added verbatim → Task 4. ✓
- **§5.2** — `NewBatchItem` interface + `createItemsBatch` signature (one `writeBatch`, mirrors `createItem` defaults, returns ids, **no** activity) → Task 5. ✓
- **§6.2** — `WorkspaceActions += createItemsBatch` in type + actions memo → Task 5. ✓
- **§9.3** — `captureReducer.ts` (`CapturePhase`, `CaptureState`, `CaptureAction`, `captureReducer`, `selectCommitItems`, least-confident-first `order`) → Task 6; `QuickCapture` props + confidence boxes (solid accent ≥0.6 / dashed amber `#C9821F`) + `createItemsBatch` commit + P4 `logActivity` call-site note → Task 7. ✓
- **§9.4 (backend)** — schemas (Task 1); `providers/types.ts` optional `detectShelfItems?` (Task 2); `providers/gemini.ts` impl with `box_2d`→`bbox` mapping, other providers undefined (Task 2); `vision.ts` handler mirroring categorize with `failed-precondition` when `!adapter.detectShelfItems` + `visionJobs` doc + `{ detections, provider, jobId }` return (Task 3); `index.ts` `onCall` export (Task 3); client wrapper (Task 4). ✓
- **§0 conventions** — TDD bite-sized steps, test commands (`npm run functions:test`, `npx vitest run`, `npm test`), commit trailer on every commit, no-legacy-touch, module under `src/features/stow/ui/mobile/`, `@/` alias. ✓
- **§1.3 token translation** + **§11 prototype→domain mapping** — applied in Task 7 (port instructions, no mock URLs, `bbox`→percent positioning, destination resolution from `spaces`). ✓
- **§7 z-index ladder** — QuickCapture overlay at z 90 → Task 8. ✓

**Deviations / risks (called out):**
- **Reducer `destination` phase:** the contract's `CapturePhase` includes `"destination"` but the `CaptureAction` union has no action that sets it; the prototype renders the destination picker as an inline overlay. The reducer keeps `"destination"` in the union for contract compliance and forward-compat but the UI drives the picker via local overlay state + `setDestination` (no `phase: "destination"` transition in P3). Documented in Task 6.
- **`QuickCapture` data wiring:** the contract fixes a 5-prop public shape (`householdId/spaceId/areaId/onClose/onCommitted`). To avoid re-subscribing Firestore inside an overlay, Task 7 supplies live data (`spaces`, `userId`, `createItemsBatch`, the injectable `detectShelfItems`/`uploadFrame`, and the captured frame) as additional props, mirroring the P2 `CaptureFirst` pattern. If P1/P2 used a `WorkspaceContext` instead, switch to that and drop the extra props. Flagged as a wiring note to reconcile against the actual P2 implementation.
- **Provider mapping leniency:** `detectShelfItems` drops malformed rows via `shelfDetectionSchema.safeParse` rather than failing the whole call, so one bad detection doesn't sink a shelf. Box corners are clamped to `[0,1]` and `w/h` floored at 0. Tested.
- **`shelfDetectionPrompt` location:** defined in `providers/gemini.ts` and imported by `vision.ts`. Acceptable for P3 (Gemini is the only provider with `detectShelfItems`); if a second provider implements it, move the prompt to `providers/common.ts`. Flagged in Task 3.
- **Shelf-frame Storage cleanup:** uploaded shelf frames land under an `_shelf` pseudo-item folder; best-effort orphan cleanup of these frames is out of P3 scope (single-item cleanup is P2's `bestEffortDeleteImage`). Noted in Task 7.
- **Playwright camera:** headless Chromium has no camera; the spec uses the `<input type=file capture>` fallback (P2's pattern) and mocks the callable via `page.route` so the functions emulator isn't required. The decisive assertions (detections render, least-confident-first ordering, N items committed) hold regardless. Selectors must be reconciled with Task 7's final markup.
