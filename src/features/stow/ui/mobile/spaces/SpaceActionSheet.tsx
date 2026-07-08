import { ActionSheet } from "@/features/stow/ui/mobile/shell/ActionSheet";
import type { SheetAction } from "@/features/stow/ui/mobile/shell/ActionSheet";
import { ChevronDown, ChevronUp, Pencil, Settings, Trash2 } from "@/features/stow/ui/mobile/theme/icons";
import type { SpaceWithAreas } from "@/types/domain";

export function SpaceActionSheet({
  space,
  itemCount,
  open,
  onClose,
  onEdit,
  onRename,
  onDelete,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown
}: {
  space: SpaceWithAreas | null;
  itemCount: number;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  if (!space) return null;

  // Keyboard-accessible alternative to the hold-and-drag reorder on the spaces list
  // (WCAG 2.1.1). Impossible directions are omitted, action-sheet style, rather than
  // rendered disabled.
  const moveActions: SheetAction[] = [
    ...(canMoveUp && onMoveUp ? [{ label: "Move up", icon: ChevronUp, onSelect: onMoveUp }] : []),
    ...(canMoveDown && onMoveDown ? [{ label: "Move down", icon: ChevronDown, onSelect: onMoveDown }] : [])
  ];

  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title={`${space.name} \u00b7 ${space.areas.length} area${space.areas.length !== 1 ? "s" : ""} \u00b7 ${itemCount} item${itemCount !== 1 ? "s" : ""}`}
      actions={[
        { label: "Edit space", icon: Settings, onSelect: onEdit },
        { label: "Rename", icon: Pencil, onSelect: onRename },
        ...moveActions,
        { label: "Delete space", icon: Trash2, destructive: true, onSelect: onDelete }
      ]}
    />
  );
}
