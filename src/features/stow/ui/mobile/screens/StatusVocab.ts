import type { LucideIcon } from "lucide-react";
import type { ItemStatus } from "@/types/domain";
import { Home, Package, Search, Users, Wrench } from "@/features/stow/ui/mobile/theme/icons";

export interface StatusMeta {
  label: string;
  color: string;
  soft: string;
  textColor: string;
  Icon: LucideIcon;
}

export const STATUS_META: Record<ItemStatus, StatusMeta> = {
  home: { label: "At home", color: "var(--stow-ink-muted)", soft: "var(--stow-border-l)", textColor: "var(--stow-ink-muted)", Icon: Home },
  packed: { label: "Packed", color: "#5B6ABF", soft: "#ECEEF8", textColor: "var(--stow-packed-text)", Icon: Package },
  lent: { label: "Lent out", color: "var(--stow-accent)", soft: "var(--stow-accent-soft)", textColor: "var(--stow-accent-text)", Icon: Users },
  repair: { label: "In repair", color: "#C4883A", soft: "#F8F0E2", textColor: "var(--stow-repair-text)", Icon: Wrench },
  lost: { label: "Missing", color: "var(--stow-danger)", soft: "var(--stow-danger-soft)", textColor: "var(--stow-danger-text)", Icon: Search }
};

export const STATUS_ORDER: ItemStatus[] = ["home", "packed", "lent", "repair", "lost"];
