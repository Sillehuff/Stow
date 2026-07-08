import {
  Archive,
  AlertTriangle,
  ArrowRight,
  Bath,
  Bed,
  Bell,
  Book,
  Box,
  Briefcase,
  Camera,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Coffee,
  DoorOpen,
  DollarSign,
  Folder,
  Gift,
  GripVertical,
  Grid,
  Heart,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Inbox,
  Key,
  LayoutGrid,
  Leaf,
  List,
  MapPin,
  MoreHorizontal,
  Music,
  Package,
  Pencil,
  Plug,
  Plus,
  QrCode,
  Refrigerator,
  RotateCcw,
  Save,
  ScanLine,
  Search,
  Settings,
  Shirt,
  Sofa,
  Sparkles,
  Star,
  Sun,
  Tag,
  Trash2,
  Tv,
  Utensils,
  Wine,
  WashingMachine,
  Wrench,
  Users,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Space/area icons addressable by a free-form string key (validated here). */
export const ICONS: Record<string, LucideIcon> = {
  // Rooms
  home: Home,
  bed: Bed,
  sofa: Sofa,
  bath: Bath,
  tv: Tv,
  door: DoorOpen,
  // Storage
  box: Box,
  package: Package,
  folder: Folder,
  archive: Archive,
  briefcase: Briefcase,
  // Kitchen
  coffee: Coffee,
  utensils: Utensils,
  wine: Wine,
  fridge: Refrigerator,
  // Outdoor / Misc
  leaf: Leaf,
  car: Car,
  sun: Sun,
  wrench: Wrench,
  wash: WashingMachine,
  shirt: Shirt,
  book: Book,
  music: Music,
  heart: Heart,
  gift: Gift,
  key: Key,
  plug: Plug,
  clock: Clock
};

export const FALLBACK_ICON: LucideIcon = Box;

export interface IconCategory {
  key: string;
  label: string;
  icons: string[];
}

export const ICON_CATEGORIES: IconCategory[] = [
  { key: "rooms", label: "Rooms", icons: ["home", "bed", "sofa", "bath", "tv", "door"] },
  { key: "storage", label: "Storage", icons: ["box", "package", "folder", "archive", "briefcase"] },
  { key: "kitchen", label: "Kitchen", icons: ["coffee", "utensils", "wine", "fridge"] },
  {
    key: "outdoor",
    label: "Outdoor",
    icons: ["leaf", "car", "sun", "wrench", "wash", "shirt", "book", "music", "heart", "gift", "key", "plug", "clock"]
  }
];

export function iconForKey(key: string | undefined | null): LucideIcon {
  if (key && ICONS[key]) return ICONS[key];
  return FALLBACK_ICON;
}

export {
  AlertTriangle,
  ArrowRight,
  Bell,
  Box,
  Book,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  DoorOpen,
  DollarSign,
  Folder,
  Gift,
  GripVertical,
  Grid,
  Heart,
  HelpCircle,
  Home,
  ImageIcon,
  Inbox,
  Key,
  LayoutGrid,
  List,
  MapPin,
  MoreHorizontal,
  Music,
  Package,
  Pencil,
  Plug,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  ScanLine,
  Search,
  Settings,
  Shirt,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Tv,
  Users,
  WashingMachine,
  Wrench,
  X
};
