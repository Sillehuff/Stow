import {
  Archive,
  Bath,
  Bed,
  Bell,
  Box,
  Briefcase,
  Camera,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Folder,
  Home,
  Leaf,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Refrigerator,
  ScanLine,
  Search,
  Settings,
  Sofa,
  Sun,
  Tag,
  Trash2,
  Utensils,
  Wine,
  Wrench,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Space/area icons addressable by a free-form string key (validated here). */
export const ICONS: Record<string, LucideIcon> = {
  home: Home,
  coffee: Coffee,
  briefcase: Briefcase,
  box: Box,
  folder: Folder,
  bed: Bed,
  sofa: Sofa,
  bath: Bath,
  car: Car,
  wrench: Wrench,
  leaf: Leaf,
  sun: Sun,
  utensils: Utensils,
  wine: Wine,
  fridge: Refrigerator,
  archive: Archive,
  package: Package
};

export const FALLBACK_ICON: LucideIcon = Box;

export interface IconCategory {
  key: string;
  label: string;
  icons: string[];
}

export const ICON_CATEGORIES: IconCategory[] = [
  { key: "rooms", label: "Rooms", icons: ["home", "bed", "sofa", "bath"] },
  { key: "storage", label: "Storage", icons: ["box", "package", "folder", "archive"] },
  { key: "kitchen", label: "Kitchen", icons: ["coffee", "utensils", "wine", "fridge"] },
  { key: "outdoor", label: "Outdoor", icons: ["leaf", "car", "sun", "wrench"] }
];

export function iconForKey(key: string | undefined | null): LucideIcon {
  if (key && ICONS[key]) return ICONS[key];
  return FALLBACK_ICON;
}

export {
  Bell,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  ScanLine,
  Search,
  Settings,
  Tag,
  Trash2,
  X
} from "lucide-react";
