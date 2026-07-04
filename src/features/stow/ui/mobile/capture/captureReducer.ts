import type { NewBatchItem } from "@/features/stow/services/repository";
import type { ShelfDetection } from "@/types/llm";

export type CapturePhase = "analyzing" | "detected" | "review" | "done";

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
  order: number[];
  cursor: number;
  drafts: Record<number, CaptureDraft>;
  destination: CaptureDestination;
}

export type CaptureAction =
  | { type: "detected"; detections: ShelfDetection[] }
  | { type: "startReview" }
  | { type: "rename"; index: number; name: string }
  | { type: "confirm"; index: number }
  | { type: "skip"; index: number }
  | { type: "setDestination"; destination: CaptureDestination };

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
  return detections
    .map((_, index) => index)
    .sort((a, b) => detections[a].confidence - detections[b].confidence);
}

function buildDrafts(detections: ShelfDetection[]): Record<number, CaptureDraft> {
  const drafts: Record<number, CaptureDraft> = {};
  detections.forEach((detection, index) => {
    drafts[index] = {
      name: detection.label,
      keep: true,
      tags: detection.tags ? [...detection.tags] : [],
      value: detection.suggestedValue
    };
  });
  return drafts;
}

function advanceCursor(state: CaptureState): number {
  return Math.min(state.cursor + 1, state.order.length);
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
      // Nothing to review → straight to done (the confirm/skip transition below can
      // never fire with an empty order).
      return { ...state, phase: state.order.length === 0 ? "done" : "review", cursor: 0 };
    case "rename": {
      const existing = state.drafts[action.index];
      if (!existing) return state;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [action.index]: { ...existing, name: action.name }
        }
      };
    }
    case "confirm":
    case "skip": {
      const nextCursor = advanceCursor(state);
      // Move straight to "done" the moment the last draft is handled, so there's no
      // intermediate render where phase is still "review" but the cursor is past the
      // end (which flashed the "No detections to review" fallback for one frame).
      const phase: CapturePhase = nextCursor >= state.order.length ? "done" : state.phase;
      const existing = state.drafts[action.index];
      if (!existing) return { ...state, phase, cursor: nextCursor };
      return {
        ...state,
        phase,
        cursor: nextCursor,
        drafts: {
          ...state.drafts,
          [action.index]: { ...existing, keep: action.type === "confirm" }
        }
      };
    }
    case "setDestination":
      return { ...state, destination: action.destination };
    default:
      return state;
  }
}

export function selectCommitItems(state: CaptureState): NewBatchItem[] {
  const { spaceId, areaId, areaNameSnapshot } = state.destination;
  if (!spaceId || !areaId) return [];

  return state.detections.reduce<NewBatchItem[]>((items, _detection, index) => {
    const draft = state.drafts[index];
    if (!draft?.keep) return items;

    const name = draft.name.trim();
    if (!name) return items;

    items.push({
      name,
      spaceId,
      areaId,
      areaNameSnapshot,
      tags: [...draft.tags],
      ...(typeof draft.value === "number" ? { value: draft.value } : {})
    });

    return items;
  }, []);
}
