import type { Area, Item, Space } from "@/types/domain";

export const seedSpaceTemplates: Array<{
  id: string;
  name: string;
  icon: Space["icon"];
  color: string;
  image?: string;
  areas: Array<{ id: string; name: string; image?: string }>;
}> = [
  {
    id: "r1",
    name: "Living Room",
    icon: "home",
    color: "#E8652B",
    areas: [
      { id: "r1-a1", name: "Console Drawer" },
      { id: "r1-a2", name: "TV Stand" },
      { id: "r1-a3", name: "Bookshelf" }
    ]
  },
  {
    id: "r2",
    name: "Kitchen",
    icon: "coffee",
    color: "#2D9F6F",
    areas: [
      { id: "r2-a1", name: "Pantry" },
      { id: "r2-a2", name: "Island" },
      { id: "r2-a3", name: "Fridge" }
    ]
  },
  {
    id: "r3",
    name: "Office",
    icon: "briefcase",
    color: "#5B6ABF",
    areas: [
      { id: "r3-a1", name: "Desk" },
      { id: "r3-a2", name: "Filing Cabinet" },
      { id: "r3-a3", name: "Shelf" }
    ]
  },
  {
    id: "r4",
    name: "Garage",
    icon: "box",
    color: "#C4883A",
    areas: [
      { id: "r4-a1", name: "Shelf A" },
      { id: "r4-a2", name: "Toolbox" },
      { id: "r4-a3", name: "Wall Hooks" }
    ]
  }
];

export const seedItemTemplates = [
  {
    id: "i1",
    name: "Titanium Scissors",
    spaceId: "r2",
    areaId: "r2-a2",
    areaNameSnapshot: "Island",
    kind: "item" as const,
    isPacked: false,
    image: "https://images.unsplash.com/photo-1574231164645-d6f0e8553590?w=400&q=80",
    value: 15,
    tags: ["Tools", "Sharp"],
    notes: ""
  },
  {
    id: "i2",
    name: "Blue Yeti Mic",
    spaceId: "r3",
    areaId: "r3-a1",
    areaNameSnapshot: "Desk",
    kind: "item" as const,
    isPacked: false,
    image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&q=80",
    value: 120,
    tags: ["Tech", "Work"],
    notes: "Serial: YT-2847291"
  },
  {
    id: "i3",
    name: "Coffee Beans (Ethiopian)",
    spaceId: "r2",
    areaId: "r2-a1",
    areaNameSnapshot: "Pantry",
    kind: "item" as const,
    isPacked: false,
    image: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=400&q=80",
    value: 20,
    tags: ["Consumable"],
    notes: "Reorder from Trade Coffee"
  },
  {
    id: "i4",
    name: "Fuji X-T5 Camera",
    spaceId: "r1",
    areaId: "r1-a1",
    areaNameSnapshot: "Console Drawer",
    kind: "item" as const,
    isPacked: false,
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80",
    value: 800,
    tags: ["Tech", "Travel"],
    notes: ""
  },
  {
    id: "i5",
    name: "Passports",
    spaceId: "r1",
    areaId: "r1-a1",
    areaNameSnapshot: "Console Drawer",
    kind: "item" as const,
    isPacked: false,
    tags: ["Important", "Travel"],
    notes: "Both passports. Exp: 2028",
    isPriceless: true
  },
  {
    id: "i6",
    name: "Tax Documents 2024",
    spaceId: "r3",
    areaId: "r3-a2",
    areaNameSnapshot: "Filing Cabinet",
    kind: "folder" as const,
    isPacked: false,
    tags: ["Important", "Financial"],
    notes: "Filed by accountant"
  },
  {
    id: "i7",
    name: "Sony WH-1000XM5",
    spaceId: "r1",
    areaId: "r1-a2",
    areaNameSnapshot: "TV Stand",
    kind: "item" as const,
    isPacked: false,
    image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80",
    value: 250,
    tags: ["Tech", "Audio"],
    notes: ""
  },
  {
    id: "i8",
    name: "Cordless Drill",
    spaceId: "r4",
    areaId: "r4-a2",
    areaNameSnapshot: "Toolbox",
    kind: "item" as const,
    isPacked: false,
    value: 90,
    tags: ["Tools"],
    notes: "DeWalt 20V"
  }
];

export type SeedSpaceTemplate = (typeof seedSpaceTemplates)[number];
export type SeedItemTemplate = (typeof seedItemTemplates)[number];

export function seedSpaceColor(index: number) {
  return seedSpaceTemplates[index % seedSpaceTemplates.length]?.color ?? `hsl(${(index * 57) % 360} 58% 45%)`;
}

export function toImageRef(url?: string) {
  return url ? { downloadUrl: url } : undefined;
}

export function normalizeSeedForHousehold(householdId: string) {
  const now = new Date();
  const spaces: Omit<Space, "createdAt" | "updatedAt">[] = seedSpaceTemplates.map((space) => ({
    id: space.id,
    householdId,
    name: space.name,
    icon: space.icon,
    color: space.color,
    image: toImageRef(space.image)
  }));

  const areas: Omit<Area, "createdAt" | "updatedAt">[] = seedSpaceTemplates.flatMap((space) =>
    space.areas.map((area) => ({
      id: area.id,
      householdId,
      spaceId: space.id,
      name: area.name,
      image: toImageRef(area.image)
    }))
  );

  const items: Omit<Item, "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "vision">[] = seedItemTemplates.map(
    (item) => ({
      id: item.id,
      householdId,
      spaceId: item.spaceId,
      areaId: item.areaId,
      areaNameSnapshot: item.areaNameSnapshot,
      name: item.name,
      kind: item.kind,
      image: toImageRef(item.image),
      value: item.value,
      isPriceless: item.isPriceless,
      tags: item.tags,
      notes: item.notes,
      isPacked: item.isPacked
    })
  );

  return { spaces, areas, items, seededAt: now };
}
