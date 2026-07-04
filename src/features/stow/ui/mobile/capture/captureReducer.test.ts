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
  { label: "", confidence: 0.44, bbox: [0.09, 0.7, 0.26, 0.17] }
];

function seeded(): CaptureState {
  let s = initialCaptureState(dest);
  s = captureReducer(s, { type: "detected", detections: DETS });
  return s;
}

describe("captureReducer setup", () => {
  it("starts in analyzing with the provided destination", () => {
    const s = initialCaptureState(dest);

    expect(s.phase).toBe("analyzing");
    expect(s.destination).toEqual(dest);
    expect(s.detections).toEqual([]);
    expect(s.order).toEqual([]);
    expect(s.cursor).toBe(0);
  });

  it("stores detections, moves to detected phase, and seeds drafts from labels", () => {
    const s = seeded();

    expect(s.phase).toBe("detected");
    expect(s.detections).toHaveLength(3);
    expect(s.drafts[0]).toEqual({ name: "Keyboard", keep: true, tags: ["Tech", "Work"], value: 140 });
    expect(s.drafts[1]).toEqual({ name: "Headphones", keep: true, tags: ["Audio"], value: undefined });
    expect(s.drafts[2]).toEqual({ name: "", keep: true, tags: [], value: undefined });
  });

  it("orders review least-confident-first", () => {
    const s = seeded();

    expect(s.order).toEqual([2, 1, 0]);
  });

  it("keeps original index order for equal confidences", () => {
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

describe("captureReducer review transitions", () => {
  it("moves to review phase at cursor 0", () => {
    const s = captureReducer(seeded(), { type: "startReview" });

    expect(s.phase).toBe("review");
    expect(s.cursor).toBe(0);
  });

  it("renames a draft without advancing", () => {
    let s = captureReducer(seeded(), { type: "startReview" });

    s = captureReducer(s, { type: "rename", index: 2, name: "Earbuds" });

    expect(s.drafts[2].name).toBe("Earbuds");
    expect(s.cursor).toBe(0);
  });

  it("confirms a draft and advances", () => {
    let s = captureReducer(seeded(), { type: "startReview" });

    s = captureReducer(s, { type: "confirm", index: 2 });

    expect(s.drafts[2].keep).toBe(true);
    expect(s.cursor).toBe(1);
  });

  it("skips a draft and advances", () => {
    let s = captureReducer(seeded(), { type: "startReview" });

    s = captureReducer(s, { type: "skip", index: 2 });

    expect(s.drafts[2].keep).toBe(false);
    expect(s.cursor).toBe(1);
  });

  it("does not advance cursor past order.length", () => {
    let s = captureReducer(seeded(), { type: "startReview" });

    s = captureReducer(s, { type: "confirm", index: 2 });
    s = captureReducer(s, { type: "skip", index: 1 });
    s = captureReducer(s, { type: "confirm", index: 0 });

    expect(s.cursor).toBe(3);

    const s2 = captureReducer(s, { type: "confirm", index: 0 });
    expect(s2.cursor).toBe(3);
  });
});

describe("captureReducer destination and commit", () => {
  it("retargets without changing phase", () => {
    let s = captureReducer(seeded(), { type: "startReview" });
    const next = { spaceId: "s2", areaId: "a9", areaNameSnapshot: "Garage" };

    s = captureReducer(s, { type: "setDestination", destination: next });

    expect(s.destination).toEqual(next);
    expect(s.phase).toBe("review");
  });

  it("moves to done after the final draft is handled", () => {
    let s = captureReducer(seeded(), { type: "startReview" });
    s = captureReducer(s, { type: "confirm", index: 2 });
    s = captureReducer(s, { type: "skip", index: 1 });
    expect(s.phase).toBe("review");

    s = captureReducer(s, { type: "confirm", index: 0 });
    expect(s.phase).toBe("done");
    expect(s.cursor).toBe(3);
  });
});

describe("selectCommitItems", () => {
  it("projects kept, named drafts to NewBatchItem using the current destination", () => {
    let s = captureReducer(seeded(), { type: "startReview" });

    s = captureReducer(s, { type: "confirm", index: 2 });
    s = captureReducer(s, { type: "skip", index: 1 });
    s = captureReducer(s, { type: "confirm", index: 0 });

    expect(selectCommitItems(s)).toEqual([
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

    expect(selectCommitItems(s).map((item) => item.name)).toEqual(["Earbuds"]);
  });

  it("trims names and drops drafts that are kept but blank", () => {
    let s = captureReducer(seeded(), { type: "startReview" });

    s = captureReducer(s, { type: "rename", index: 0, name: "  Spaced Keyboard  " });
    s = captureReducer(s, { type: "confirm", index: 0 });
    s = captureReducer(s, { type: "rename", index: 1, name: "   " });
    s = captureReducer(s, { type: "confirm", index: 1 });
    s = captureReducer(s, { type: "skip", index: 2 });

    expect(selectCommitItems(s).map((item) => item.name)).toEqual(["Spaced Keyboard"]);
  });

  it("omits value and keeps empty tags when absent", () => {
    const dets: ShelfDetection[] = [{ label: "Box", confidence: 0.5, bbox: [0, 0, 1, 1] }];
    let s = initialCaptureState(dest);

    s = captureReducer(s, { type: "detected", detections: dets });
    s = captureReducer(s, { type: "startReview" });
    s = captureReducer(s, { type: "confirm", index: 0 });

    const items = selectCommitItems(s);
    expect(items[0]).toEqual({ name: "Box", spaceId: "s1", areaId: "a1", areaNameSnapshot: "Desk", tags: [] });
    expect(items[0]).not.toHaveProperty("value");
  });

  it("returns an empty array when nothing is kept", () => {
    let s = captureReducer(seeded(), { type: "startReview" });

    s = captureReducer(s, { type: "skip", index: 2 });
    s = captureReducer(s, { type: "skip", index: 1 });
    s = captureReducer(s, { type: "skip", index: 0 });

    expect(selectCommitItems(s)).toEqual([]);
  });

  it("returns an empty array when the destination is incomplete", () => {
    let s = initialCaptureState({ spaceId: null, areaId: "a1", areaNameSnapshot: "Desk" });

    s = captureReducer(s, { type: "detected", detections: DETS });
    s = captureReducer(s, { type: "startReview" });
    s = captureReducer(s, { type: "confirm", index: 0 });

    expect(selectCommitItems(s)).toEqual([]);
  });
});
