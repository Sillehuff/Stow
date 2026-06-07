import type { Item } from "@/types/domain";
import { ItemRow } from "@/features/stow/ui/mobile/components/ItemRow";

export function ResultRow({
  item,
  query: _query,
  onClick,
  spaceName
}: {
  item: Item;
  query?: string;
  onClick?: () => void;
  spaceName?: string;
}) {
  return <ItemRow item={item} onClick={onClick} spaceName={spaceName} />;
}
