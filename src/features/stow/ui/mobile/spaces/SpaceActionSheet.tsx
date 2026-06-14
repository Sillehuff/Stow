import { ActionSheet } from "@/features/stow/ui/mobile/shell/ActionSheet";
import { Pencil, Settings, Trash2 } from "@/features/stow/ui/mobile/theme/icons";
import type { SpaceWithAreas } from "@/types/domain";

export function SpaceActionSheet({
  space,
  itemCount,
  open,
  onClose,
  onEdit,
  onRename,
  onDelete
}: {
  space: SpaceWithAreas | null;
  itemCount: number;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  if (!space) return null;

  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title={`${space.name} \u00b7 ${space.areas.length} area${space.areas.length !== 1 ? "s" : ""} \u00b7 ${itemCount} item${itemCount !== 1 ? "s" : ""}`}
      actions={[
        { label: "Edit space", icon: Settings, onSelect: onEdit },
        { label: "Rename", icon: Pencil, onSelect: onRename },
        { label: "Delete space", icon: Trash2, destructive: true, onSelect: onDelete }
      ]}
    />
  );
}
