# Packing List Templates — Implementation Plan

## Decisions
- Per-list independent packed tracking (no global `isPacked` involvement)
- Flat list of packing lists (no template/trip distinction)
- "Import items" button when creating/editing a list to pull items from an existing list
- No badge on the Packing nav tab

## Implementation Steps

### 1. Domain types (`src/types/domain.ts`)
- Add `PackingList` interface:
  ```ts
  interface PackingList {
    id: string;
    householdId: string;
    name: string;
    itemIds: string[];          // inventory item references
    packedItemIds: string[];    // checked-off items within this list
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
    updatedBy: string;
  }
  ```

### 2. Firestore paths (`src/lib/firebase/paths.ts`)
- Add `packingLists` and `packingList` paths under household

### 3. Firestore rules (`firestore.rules`)
- Add read/write rules for `households/{householdId}/packingLists/{listId}` — member access

### 4. Repository (`src/features/stow/services/repository.ts`)
- `subscribePackingLists(householdId, onData, onError)` — real-time listener
- `createPackingList({ householdId, userId, name, itemIds })` — create new list
- `updatePackingList({ householdId, listId, userId, patch })` — rename, update items
- `deletePackingList({ householdId, listId })` — delete a list
- `togglePackingListItem({ householdId, listId, userId, itemId, packed })` — add/remove from packedItemIds
- `clearPackingListPacked({ householdId, listId, userId })` — reset packedItemIds to []

### 5. Hook (`src/features/stow/hooks/useWorkspaceData.ts`)
- Subscribe to packingLists collection
- Expose `packingLists` in the returned workspace data
- Add new actions to `WorkspaceActions`

### 6. UI — Packing tab rewrite (`src/features/stow/ui/StowApp.tsx`)

**Remove from current packing tab:**
- Unpacked / Packed / All filter pills
- Space / Area dropdowns
- Type / Group By / Sort dropdowns
- "Mark visible packed" / "Mark visible unpacked" buttons
- All `packingShow`, `packingSpaceFilter`, `packingAreaFilter`, `packingKindFilter`, `packingGroupBy`, `packingSort` URL params and filtering logic

**List Selector View (default at `/packing`):**
- "Packing" header (no sync pill needed here)
- "+ New List" button
- List of packing list cards, each showing:
  - Name
  - Progress: "X of Y packed"
  - Mini progress bar
  - "..." menu → Edit name, Delete
- Tap a card → navigates to `/packing?listId=X`
- Empty state when no lists exist

**Packing View (at `/packing?listId=X`):**
- Back arrow → returns to list selector
- List name as header
- Progress bar: "X of Y packed" (scoped to this list only)
- Item checklist:
  - Checkbox to toggle packed (updates `packedItemIds` on the list doc)
  - Item name, location subtitle, optional thumbnail
  - Packed items get strikethrough + opacity treatment (same as current)
- "Add Items" button → opens item picker
- "Clear All" button → resets all checks
- Each item has a remove option (remove from list, not delete from inventory)

**Item Picker (modal/overlay):**
- Shows all inventory items grouped by space > area
- Checkboxes to select/deselect (pre-checked for items already on the list)
- "Import from list" button at top → dropdown of existing packing lists → selects those items
- Search bar to filter items
- "Done" button to confirm

### 7. Navigation updates
- Remove packed count badge from Packing nav tab
- `/packing` → list selector
- `/packing?listId=X` → packing view for that list
- Remove old packing URL params (`show`, `spaceId`, `areaId`, `kind`, `groupBy`, `sort`)

### 8. Clean up
- Remove `packedItems` derived value usage in nav badge
- Remove old packing filter state variables
- Remove `applyBulkPacking` function (replaced by per-list clear)
- Keep `isPacked` on Item type for now (existing field, no migration needed) but packing tab no longer reads/writes it
