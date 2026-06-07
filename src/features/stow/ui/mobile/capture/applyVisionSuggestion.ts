import type { VisionSuggestion } from "@/types/llm";

/**
 * The mutable item-draft fields the Add Item / Edit / Capture-first flows hold
 * as strings while the user is editing. `value` is a string here because it is
 * bound to a numeric text input; it is parsed to a number only at save time.
 */
export interface ItemDraftFields {
  name: string;
  tags: string[];
  notes: string;
  value: string;
}

/**
 * Apply an AI VisionSuggestion to draft fields per contract 9.2:
 * fill name/tags/notes, never value (value stays a manual field).
 * User-entered values win - we only fill empties and merge tags.
 */
export function applyVisionSuggestion(
  fields: ItemDraftFields,
  suggestion: VisionSuggestion
): ItemDraftFields {
  const suggestedName = suggestion.suggestedName?.trim() ?? "";
  const name = fields.name.trim() ? fields.name : suggestedName;

  const suggestedNotes = suggestion.notes?.trim() ?? "";
  const notes = fields.notes.trim() ? fields.notes : suggestedNotes;

  const mergedTags = [...fields.tags];
  for (const tag of suggestion.tags ?? []) {
    if (tag && !mergedTags.includes(tag)) mergedTags.push(tag);
  }

  return {
    ...fields,
    name,
    notes,
    tags: mergedTags
    // value intentionally left untouched (contract 9.2)
  };
}
