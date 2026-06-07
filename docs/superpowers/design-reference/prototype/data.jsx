/* Stow sample data + theme palette. Exported to window. */

/* Palette is derived from tweaks (accent + dark mode) so theme controls cascade. */
function makePalette(accent, dark, radius) {
  if (dark) {
    return {
      ink: "#F4F4F8", inkSoft: "#D7D7E0", inkMuted: "#9A9AAE",
      warm: "#76768A", border: "#2C2C3C", borderL: "#23232F",
      surface: "#181822", canvas: "#101019",
      accent: accent, accentSoft: "color-mix(in srgb, " + accent + " 22%, #181822)",
      success: "#34C088", successSoft: "color-mix(in srgb, #34C088 18%, #181822)",
      danger: "#F26060", dangerSoft: "color-mix(in srgb, #F26060 18%, #181822)",
      shadow: "0 2px 12px rgba(0,0,0,0.4)", shadowSoft: "0 1px 3px rgba(0,0,0,0.3)",
      radius: radius,
    };
  }
  return {
    ink: "#1A1A2E", inkSoft: "#2D2D44", inkMuted: "#6B6B80",
    warm: "#9595A8", border: "#E8E8EE", borderL: "#F0F0F5",
    surface: "#FFFFFF", canvas: "#F7F7FA",
    accent: accent, accentSoft: "color-mix(in srgb, " + accent + " 12%, #FFFFFF)",
    success: "#2D9F6F", successSoft: "#EAFAF2",
    danger: "#E04545", dangerSoft: "#FFF0F0",
    shadow: "0 2px 10px rgba(0,0,0,0.05)", shadowSoft: "0 1px 3px rgba(0,0,0,0.04)",
    radius: radius,
  };
}

const ROOMS = [
  { id: "r1", name: "Living Room", icon: "Home", color: "#E8652B", image: "", areas: [
    { name: "Console Drawer" }, { name: "TV Stand" }, { name: "Bookshelf" }
  ]},
  { id: "r2", name: "Kitchen", icon: "Coffee", color: "#2D9F6F", image: "", areas: [
    { name: "Pantry" }, { name: "Island" }, { name: "Fridge" }
  ]},
  { id: "r3", name: "Office", icon: "Briefcase", color: "#5B6ABF", image: "", areas: [
    { name: "Desk" }, { name: "Filing Cabinet" }, { name: "Shelf" }
  ]},
  { id: "r4", name: "Garage", icon: "Box", color: "#C4883A", image: "", areas: [
    { name: "Shelf A" }, { name: "Toolbox" }, { name: "Wall Hooks" }
  ]},
];

const ITEMS = [
  { id: "i1", name: "Titanium Scissors", roomId: "r2", area: "Island", isPacked: false, image: "https://images.unsplash.com/photo-1574231164645-d6f0e8553590?w=400&q=80", value: 15, tags: ["Tools", "Sharp"], notes: "", createdAt: "2025-12-01" },
  { id: "i2", name: "Blue Yeti Mic", roomId: "r3", area: "Desk", isPacked: true, image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&q=80", value: 120, tags: ["Tech", "Work"], notes: "Serial: YT-2847291", createdAt: "2025-11-15" },
  { id: "i3", name: "Coffee Beans (Ethiopian)", roomId: "r2", area: "Pantry", isPacked: false, image: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=400&q=80", value: 20, tags: ["Consumable"], notes: "Reorder from Trade Coffee", createdAt: "2026-01-20" },
  { id: "i4", name: "Fuji X-T5 Camera", roomId: "r1", area: "Console Drawer", isPacked: true, image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80", value: 800, tags: ["Tech", "Travel"], notes: "", createdAt: "2025-10-01" },
  { id: "i5", name: "Passports", roomId: "r1", area: "Console Drawer", isPacked: true, value: 0, tags: ["Important", "Travel"], notes: "Both passports. Exp: 2028", createdAt: "2025-06-10", isPriceless: true },
  { id: "i6", name: "Tax Documents 2024", roomId: "r3", area: "Filing Cabinet", isFolder: true, tags: ["Important", "Financial"], notes: "Filed by accountant", createdAt: "2026-02-01" },
  { id: "i7", name: "Sony WH-1000XM5", roomId: "r1", area: "TV Stand", isPacked: false, image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80", value: 250, tags: ["Tech", "Audio"], notes: "", createdAt: "2025-09-14" },
  { id: "i8", name: "Cordless Drill", roomId: "r4", area: "Toolbox", isPacked: false, value: 90, tags: ["Tools"], notes: "DeWalt 20V", createdAt: "2025-08-20" },
  { id: "i9", name: "Cast Iron Skillet", roomId: "r2", area: "Island", isPacked: false, value: 45, tags: ["Cookware"], notes: "Lodge 12in", createdAt: "2025-07-11" },
  { id: "i10", name: "Mechanical Keyboard", roomId: "r3", area: "Desk", isPacked: false, image: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=400&q=80", value: 140, tags: ["Tech", "Work"], notes: "Keychron K2", createdAt: "2025-05-30" },
];

const PACKING_LISTS = [
  { id: "p1", name: "Weekend Trip", itemIds: ["i4", "i5", "i7"], packedItemIds: ["i4", "i5"] },
  { id: "p2", name: "Camping", itemIds: ["i1", "i8", "i9"], packedItemIds: [] },
];

const MEMBERS = [
  { uid: "u1", name: "You", email: "you@home.co", role: "OWNER" },
  { uid: "u2", name: "Sam Rivera", email: "sam@home.co", role: "ADMIN" },
  { uid: "u3", name: "Jess Park", email: "jess@home.co", role: "MEMBER" },
];

/* Candidate photos shown in the simulated camera roll / capture result.
   First entry doubles as the AI-identified capture (Sony headphones). */
const PHOTO_POOL = [
  "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80",
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80",
  "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=400&q=80",
  "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&q=80",
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80",
  "https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=400&q=80",
  "https://images.unsplash.com/photo-1574231164645-d6f0e8553590?w=400&q=80",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80",
];
/* Wider crop used as the simulated live camera feed. */
const CAMERA_FEED = "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=900&q=80";

Object.assign(window, {
  StowData: { ROOMS, ITEMS, PACKING_LISTS, MEMBERS, PHOTO_POOL, CAMERA_FEED },
  makePalette,
});
