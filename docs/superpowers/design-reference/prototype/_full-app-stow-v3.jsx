import { useState, useRef } from "react";
import {
  Home, Search, Package, Settings, ChevronRight, Plus,
  Folder, Briefcase, Box, Moon,
  Clock, Square, MoreHorizontal,
  ChevronLeft, Inbox, Trash2, X, Camera, Grid,
  List, Tag, MapPin, Star, DollarSign,
  ChevronDown, Copy, Share2, Heart, Filter, Zap,
  Check, Bell, ArrowRight, Edit, AlertCircle, CheckCircle,
  Bookmark, Coffee, Image, Save, XCircle
} from "lucide-react";

const P = {
  ink: "#1A1A2E", inkSoft: "#2D2D44", inkMuted: "#6B6B80",
  warm: "#9595A8", border: "#E8E8EE", borderL: "#F0F0F5",
  surface: "#FFFFFF", canvas: "#F7F7FA",
  accent: "#E8652B", accentSoft: "#FFF0EA",
  success: "#2D9F6F", successSoft: "#EAFAF2",
  danger: "#E04545", dangerSoft: "#FFF0F0",
  hi: "#FFE566",
};

const ROOMS = [
  { id: "r1", name: "Living Room", icon: "home", color: "#E8652B", image: "", areas: [
    { name: "Console Drawer", image: "" }, { name: "TV Stand", image: "" }, { name: "Bookshelf", image: "" }
  ]},
  { id: "r2", name: "Kitchen", icon: "coffee", color: "#2D9F6F", image: "", areas: [
    { name: "Pantry", image: "" }, { name: "Island", image: "" }, { name: "Fridge", image: "" }
  ]},
  { id: "r3", name: "Office", icon: "briefcase", color: "#5B6ABF", image: "", areas: [
    { name: "Desk", image: "" }, { name: "Filing Cabinet", image: "" }, { name: "Shelf", image: "" }
  ]},
  { id: "r4", name: "Garage", icon: "box", color: "#C4883A", image: "", areas: [
    { name: "Shelf A", image: "" }, { name: "Toolbox", image: "" }, { name: "Wall Hooks", image: "" }
  ]},
];

const ITEMS = [
  { id: "i1", name: "Titanium Scissors", roomId: "r2", area: "Island", isPacked: false, image: "https://images.unsplash.com/photo-1574231164645-d6f0e8553590?w=400&q=80", value: 15, tags: ["Tools", "Sharp"], notes: "", createdAt: "2025-12-01" },
  { id: "i2", name: "Blue Yeti Mic", roomId: "r3", area: "Desk", isPacked: false, image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&q=80", value: 120, tags: ["Tech", "Work"], notes: "Serial: YT-2847291", createdAt: "2025-11-15" },
  { id: "i3", name: "Coffee Beans (Ethiopian)", roomId: "r2", area: "Pantry", isPacked: false, image: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=400&q=80", value: 20, tags: ["Consumable"], notes: "Reorder from Trade Coffee", createdAt: "2026-01-20" },
  { id: "i4", name: "Fuji X-T5 Camera", roomId: "r1", area: "Console Drawer", isPacked: false, image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80", value: 800, tags: ["Tech", "Travel"], notes: "", createdAt: "2025-10-01" },
  { id: "i5", name: "Passports", roomId: "r1", area: "Console Drawer", isPacked: false, value: 0, tags: ["Important", "Travel"], notes: "Both passports. Exp: 2028", createdAt: "2025-06-10", isPriceless: true },
  { id: "i6", name: "Tax Documents 2024", roomId: "r3", area: "Filing Cabinet", isFolder: true, tags: ["Important", "Financial"], notes: "Filed by accountant", createdAt: "2026-02-01" },
  { id: "i7", name: "Sony WH-1000XM5", roomId: "r1", area: "TV Stand", isPacked: false, image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80", value: 250, tags: ["Tech", "Audio"], notes: "", createdAt: "2025-09-14" },
  { id: "i8", name: "Cordless Drill", roomId: "r4", area: "Toolbox", isPacked: false, value: 90, tags: ["Tools"], notes: "DeWalt 20V", createdAt: "2025-08-20" },
];

const ICONS = { home: Home, coffee: Coffee, briefcase: Briefcase, box: Box, folder: Folder };
var getIcon = function(k) { return ICONS[k] || Box; };

/* ── helper: get area name string from area object or legacy string ── */
var areaName = function(a) { return typeof a === "string" ? a : a.name; };
var areaImg = function(a) { return typeof a === "string" ? "" : (a.image || ""); };

function NavBtn({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 72, border: "none", background: "none", cursor: "pointer", position: "relative" }}>
      <div style={{ position: "relative", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", height: 28 }}>
        {active && <div style={{ position: "absolute", inset: -6, borderRadius: 99, background: P.accentSoft }} />}
        <Icon size={22} strokeWidth={active ? 2.5 : 1.8} color={active ? P.accent : P.warm} style={{ position: "relative", zIndex: 1 }} />
        {badge && (
          <div style={{ position: "absolute", top: -6, right: -10, background: P.accent, color: "#fff", fontSize: 9, fontWeight: 900, width: 17, height: 17, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
            {badge}
          </div>
        )}
      </div>
      <span style={{ fontSize: 10, fontWeight: active ? 800 : 600, color: active ? P.accent : P.warm, letterSpacing: 0.3 }}>{label}</span>
    </button>
  );
}

function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "28px 28px 0 0", boxShadow: "0 -10px 40px rgba(0,0,0,0.12)", maxHeight: "85%", display: "flex", flexDirection: "column", animation: "sheetUp 0.3s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 5, borderRadius: 99, background: "#E0E0E6" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 24px 12px" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: P.ink, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 99, background: P.canvas, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} color={P.inkMuted} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 32px" }}>{children}</div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: P.warm, marginBottom: 10, marginLeft: 2 }}>{children}</div>;
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: P.warm, marginBottom: 6 }}>{children}</div>;
}

function Input({ value, onChange, placeholder, type }) {
  return (
    <input
      value={value} onChange={onChange} placeholder={placeholder} type={type || "text"}
      style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, padding: "12px 16px", fontSize: 15, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit" }}
    />
  );
}

/* ── Image URL input with preview ── */
function ImageInput({ value, onChange, label }) {
  return (
    <div>
      <FieldLabel>{label || "Photo URL"}</FieldLabel>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {value ? (
          <div style={{ position: "relative", width: 48, height: 48, borderRadius: 12, overflow: "hidden", flexShrink: 0, border: "1px solid " + P.borderL }}>
            <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button onClick={function() { onChange(""); }} style={{ position: "absolute", top: -2, right: -2, width: 18, height: 18, borderRadius: 99, background: P.danger, border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
              <X size={9} color="#fff" />
            </button>
          </div>
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: 12, background: P.canvas, border: "1.5px dashed " + P.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Image size={16} color={P.warm} />
          </div>
        )}
        <input
          value={value || ""} onChange={function(e) { onChange(e.target.value); }} placeholder="Paste image URL..."
          style={{ flex: 1, boxSizing: "border-box", borderRadius: 14, padding: "12px 16px", fontSize: 13, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit", minWidth: 0 }}
        />
      </div>
    </div>
  );
}

/* ── Tag Picker with create-new ── */
function TagPicker({ allTags, selectedTags, onToggle, onCreate, onClose }) {
  var [newTag, setNewTag] = useState("");
  var available = allTags.filter(function(t) { return selectedTags.indexOf(t) < 0; });

  var handleCreate = function() {
    var trimmed = newTag.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewTag("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Currently assigned */}
      {selectedTags.length > 0 && (
        <div>
          <FieldLabel>Assigned Tags</FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {selectedTags.map(function(t) {
              return (
                <button key={t} onClick={function() { onToggle(t); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: P.accent, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  <Tag size={11} /> {t} <X size={11} style={{ marginLeft: 2, opacity: 0.7 }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Available tags */}
      {available.length > 0 && (
        <div>
          <FieldLabel>Available Tags</FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {available.map(function(t) {
              return (
                <button key={t} onClick={function() { onToggle(t); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: P.canvas, color: P.inkSoft, border: "1px solid " + P.borderL, cursor: "pointer", fontFamily: "inherit" }}>
                  <Tag size={11} /> {t} <Plus size={11} style={{ marginLeft: 2, opacity: 0.5 }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Create new tag */}
      <div>
        <FieldLabel>Create New Tag</FieldLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newTag} onChange={function(e) { setNewTag(e.target.value); }}
            onKeyDown={function(e) { if (e.key === "Enter") handleCreate(); }}
            placeholder="New tag name..."
            style={{ flex: 1, boxSizing: "border-box", borderRadius: 14, padding: "10px 16px", fontSize: 14, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit" }}
          />
          <button onClick={handleCreate}
            style={{ padding: "10px 18px", borderRadius: 14, fontSize: 13, fontWeight: 700, border: "none", background: newTag.trim() ? P.accent : P.border, color: newTag.trim() ? "#fff" : P.warm, cursor: newTag.trim() ? "pointer" : "default", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            + Create
          </button>
        </div>
      </div>

      <button onClick={onClose} style={{ width: "100%", padding: "12px 0", borderRadius: 16, fontWeight: 700, fontSize: 14, border: "none", background: P.ink, color: "#fff", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>Done</button>
    </div>
  );
}


export default function App() {
  var [tab, setTab] = useState("home");
  var [items, setItems] = useState(ITEMS);
  var [rooms, setRooms] = useState(ROOMS);
  var [roomId, setRoomId] = useState(null);
  var [itemId, setItemId] = useState(null);
  var [areaFilter, setAreaFilter] = useState("All");
  var [scanner, setScanner] = useState(false);
  var [addItem, setAddItem] = useState(false);
  var [addSpace, setAddSpace] = useState(false);
  var [fabOpen, setFabOpen] = useState(false);
  var [qrLabel, setQrLabel] = useState(false);
  var [moveItem, setMoveItem] = useState(false);
  var [delConfirm, setDelConfirm] = useState(null);
  var [q, setQ] = useState("");
  var [gridView, setGridView] = useState(false);
  var [toast, setToast] = useState(null);

  /* add item fields */
  var [niName, setNiName] = useState("");
  var [niRoom, setNiRoom] = useState("");
  var [niArea, setNiArea] = useState("");
  var [niVal, setNiVal] = useState("");
  var [niTags, setNiTags] = useState("");
  var [niNotes, setNiNotes] = useState("");
  var [niImage, setNiImage] = useState("");

  /* add space fields */
  var [nsName, setNsName] = useState("");
  var [nsAreas, setNsAreas] = useState("");
  var [nsImage, setNsImage] = useState("");

  /* add area */
  var [addArea, setAddArea] = useState(false);
  var [naName, setNaName] = useState("");
  var [naImage, setNaImage] = useState("");

  /* edit item state */
  var [editing, setEditing] = useState(false);
  var [editName, setEditName] = useState("");
  var [editNotes, setEditNotes] = useState("");
  var [editValue, setEditValue] = useState("");
  var [editImage, setEditImage] = useState("");

  /* tag picker */
  var [tagPicker, setTagPicker] = useState(false);

  /* edit space / area photos */
  var [editSpacePhoto, setEditSpacePhoto] = useState(false);
  var [editSpaceUrl, setEditSpaceUrl] = useState("");
  var [editAreaPhoto, setEditAreaPhoto] = useState(null); // area name string
  var [editAreaUrl, setEditAreaUrl] = useState("");

  var room = rooms.find(function(r) { return r.id === roomId; });
  var item = items.find(function(i) { return i.id === itemId; });
  var roomItems = items.filter(function(i) { return i.roomId === roomId; });
  var filtered = areaFilter === "All" ? roomItems : roomItems.filter(function(i) { return i.area === areaFilter; });
  var searched = q ? items.filter(function(i) {
    var ql = q.toLowerCase();
    var nameMatch = i.name.toLowerCase().includes(ql);
    var tagMatch = (i.tags || []).some(function(t) { return t.toLowerCase().includes(ql); });
    var rm = rooms.find(function(r) { return r.id === i.roomId; });
    var roomMatch = rm ? rm.name.toLowerCase().includes(ql) : false;
    return nameMatch || tagMatch || roomMatch;
  }) : [];
  var packed = items.filter(function(i) { return i.isPacked; });
  var allTags = Array.from(new Set(items.flatMap(function(i) { return i.tags || []; })));

  var flash = function(msg) { setToast(msg); setTimeout(function() { setToast(null); }, 2200); };
  var togglePack = function(id) { setItems(items.map(function(i) { return i.id === id ? Object.assign({}, i, { isPacked: !i.isPacked }) : i; })); };

  var doAddItem = function() {
    if (!niName.trim()) return;
    var r = niRoom || roomId || rooms[0].id;
    var rm = rooms.find(function(x) { return x.id === r; });
    var a = niArea || (rm ? areaName(rm.areas[0]) : "");
    var newItem = {
      id: "i" + Date.now(), name: niName.trim(), roomId: r, area: a, isPacked: false,
      image: niImage || undefined,
      value: niVal ? parseFloat(niVal) : 0,
      tags: niTags ? niTags.split(",").map(function(t) { return t.trim(); }).filter(Boolean) : [],
      notes: niNotes, createdAt: new Date().toISOString().split("T")[0]
    };
    setItems(items.concat([newItem]));
    setAddItem(false); setNiName(""); setNiRoom(""); setNiArea(""); setNiVal(""); setNiTags(""); setNiNotes(""); setNiImage("");
    flash("Item added!");
  };

  var doAddSpace = function() {
    if (!nsName.trim()) return;
    var areaList = nsAreas ? nsAreas.split(",").map(function(a) { return { name: a.trim(), image: "" }; }).filter(function(a) { return a.name; }) : [{ name: "Main", image: "" }];
    var sp = { id: "r" + Date.now(), name: nsName.trim(), icon: "box", color: "hsl(" + Math.floor(Math.random() * 360) + ",50%,45%)", image: nsImage || "", areas: areaList };
    setRooms(rooms.concat([sp]));
    setAddSpace(false); setNsName(""); setNsAreas(""); setNsImage("");
    flash("Space created!");
  };

  var doAddArea = function() {
    if (!naName.trim() || !roomId) return;
    setRooms(rooms.map(function(r) {
      if (r.id !== roomId) return r;
      return Object.assign({}, r, { areas: r.areas.concat([{ name: naName.trim(), image: naImage || "" }]) });
    }));
    setAddArea(false); setNaName(""); setNaImage("");
    flash("Area added!");
  };

  var doMove = function(rid, area) {
    setItems(items.map(function(i) { return i.id === itemId ? Object.assign({}, i, { roomId: rid, area: area }) : i; }));
    setMoveItem(false); flash("Item moved!");
  };

  var doDelete = function(id) {
    setItems(items.filter(function(i) { return i.id !== id; }));
    setDelConfirm(null); setItemId(null); setEditing(false); flash("Item deleted");
  };

  /* Start editing item */
  var startEdit = function() {
    if (!item) return;
    setEditName(item.name);
    setEditNotes(item.notes || "");
    setEditValue(item.value ? String(item.value) : "");
    setEditImage(item.image || "");
    setEditing(true);
  };

  /* Save edited item */
  var saveEdit = function() {
    if (!item || !editName.trim()) return;
    setItems(items.map(function(i) {
      if (i.id !== item.id) return i;
      return Object.assign({}, i, {
        name: editName.trim(),
        notes: editNotes,
        value: editValue ? parseFloat(editValue) : 0,
        image: editImage || undefined,
      });
    }));
    setEditing(false);
    flash("Item updated!");
  };

  /* Tag toggling on current item */
  var toggleItemTag = function(tag) {
    if (!item) return;
    setItems(items.map(function(i) {
      if (i.id !== item.id) return i;
      var tags = i.tags || [];
      var has = tags.indexOf(tag) >= 0;
      return Object.assign({}, i, { tags: has ? tags.filter(function(t) { return t !== tag; }) : tags.concat([tag]) });
    }));
  };

  var createAndAddTag = function(tag) {
    if (!item) return;
    setItems(items.map(function(i) {
      if (i.id !== item.id) return i;
      var tags = i.tags || [];
      if (tags.indexOf(tag) >= 0) return i;
      return Object.assign({}, i, { tags: tags.concat([tag]) });
    }));
  };

  /* Save space photo */
  var saveSpacePhoto = function() {
    setRooms(rooms.map(function(r) {
      if (r.id !== roomId) return r;
      return Object.assign({}, r, { image: editSpaceUrl });
    }));
    setEditSpacePhoto(false); setEditSpaceUrl("");
    flash("Space photo updated!");
  };

  /* Save area photo */
  var saveAreaPhoto = function() {
    if (!editAreaPhoto) return;
    setRooms(rooms.map(function(r) {
      if (r.id !== roomId) return r;
      return Object.assign({}, r, {
        areas: r.areas.map(function(a) {
          if (areaName(a) !== editAreaPhoto) return a;
          return { name: areaName(a), image: editAreaUrl };
        })
      });
    }));
    setEditAreaPhoto(null); setEditAreaUrl("");
    flash("Area photo updated!");
  };

  var doScan = function() {
    setScanner(false); flash("AI scanning...");
    setTimeout(function() {
      var rm2 = rooms.find(function(r) { return r.id === roomId; });
      var n = { id: "i" + Date.now(), name: "Sony Headphones", roomId: roomId || "r1", area: rm2 ? areaName(rm2.areas[0]) : "TV Stand", isPacked: false, image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80", value: 250, tags: ["Tech", "Audio"], notes: "", createdAt: new Date().toISOString().split("T")[0] };
      setItems(function(prev) { return prev.concat([n]); });
      flash("Item identified & added!");
      setItemId(n.id);
    }, 1200);
  };

  var loadTemplate = function() {
    setItems(items.map(function(i) { return Object.assign({}, i, { isPacked: ["i4", "i5", "i7"].indexOf(i.id) >= 0 }); }));
    flash("Loaded 'Weekend Trip'");
  };

  var cs = { display: "flex", alignItems: "center" };
  var card = { background: P.surface, borderRadius: 20, border: "1px solid " + P.borderL, boxShadow: "0 2px 10px rgba(0,0,0,0.03)" };
  var pill = function(active) { return { padding: "8px 16px", borderRadius: 99, fontSize: 13, fontWeight: 700, border: active ? "none" : "1px solid " + P.border, background: active ? P.ink : "transparent", color: active ? "#fff" : P.inkMuted, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }; };
  var btn = function(bg, color) { return { width: "100%", padding: "14px 0", borderRadius: 18, fontWeight: 700, fontSize: 15, border: "none", background: bg, color: color, cursor: "pointer", fontFamily: "inherit" }; };

  var getRoomName = function(rid) { var r = rooms.find(function(x) { return x.id === rid; }); return r ? r.name : ""; };

  /* ══════════════════════ HOME ══════════════════════ */
  var renderHome = function() {
    if (itemId) return renderDetail();
    if (roomId) return renderRoom();
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas }}>
        <div style={{ padding: "48px 24px 8px" }}>
          <div style={Object.assign({}, cs, { justifyContent: "space-between" })}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: P.ink, letterSpacing: -0.5 }}>Stow<span style={{ color: P.accent }}>.</span></h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: P.warm }}>{items.length} items across {rooms.length} spaces</p>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 120px" }}>
          <div style={{ height: 16 }} />
          <Label>Your Spaces</Label>
          <div style={Object.assign({}, card, { overflow: "hidden" })}>
            {rooms.map(function(rm, idx) {
              var Ic = getIcon(rm.icon);
              var cnt = items.filter(function(i) { return i.roomId === rm.id; }).length;
              return (
                <div key={rm.id} onClick={function() { setRoomId(rm.id); setAreaFilter("All"); }}
                  style={Object.assign({}, cs, { justifyContent: "space-between", padding: "14px 20px", cursor: "pointer", borderBottom: idx < rooms.length - 1 ? "1px solid " + P.borderL : "none" })}>
                  <div style={Object.assign({}, cs, { gap: 14 })}>
                    {rm.image ? (
                      <img src={rm.image} alt="" style={{ width: 42, height: 42, borderRadius: 14, objectFit: "cover", border: "1px solid " + P.borderL }} />
                    ) : (
                      <div style={{ width: 42, height: 42, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: rm.color + "14", color: rm.color }}>
                        <Ic size={20} strokeWidth={1.8} />
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{rm.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: P.warm, marginTop: 2 }}>{rm.areas.length} areas · {cnt} item{cnt !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color={P.border} />
                </div>
              );
            })}
            <div onClick={function() { setAddSpace(true); }} style={Object.assign({}, cs, { justifyContent: "center", gap: 8, padding: 16, cursor: "pointer", borderTop: "1px solid " + P.borderL, color: P.accent, fontWeight: 700, fontSize: 14 })}>
              <Plus size={16} strokeWidth={2.5} /> Add Space
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════════════ ROOM ══════════════════════ */
  var renderRoom = function() {
    var areas = room ? room.areas : [];
    var isInArea = areaFilter !== "All";

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas }}>
        <div style={{ padding: "48px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid " + P.borderL, position: "sticky", top: 0, zIndex: 20 }}>
          <button onClick={function() { if (isInArea) { setAreaFilter("All"); } else { setRoomId(null); } }} style={Object.assign({}, cs, { gap: 2, background: "none", border: "none", cursor: "pointer", color: P.accent, fontWeight: 700, fontSize: 15, padding: "8px 4px", fontFamily: "inherit" })}>
            <ChevronLeft size={20} strokeWidth={2.5} /> {isInArea ? room.name : "Spaces"}
          </button>
          <span style={{ fontSize: 17, fontWeight: 700, color: P.ink }}>{isInArea ? areaFilter : (room ? room.name : "")}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={function() { setEditSpaceUrl(room ? (room.image || "") : ""); setEditSpacePhoto(true); }} style={{ padding: 8, background: "none", border: "none", cursor: "pointer" }}>
              <Camera size={18} color={P.inkMuted} />
            </button>
            <button onClick={function() { setQrLabel(true); }} style={{ padding: 8, background: "none", border: "none", cursor: "pointer" }}>
              <Grid size={18} color={P.inkMuted} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>

          {/* Space hero image if set */}
          {!isInArea && room && room.image && (
            <div style={{ marginBottom: 16, borderRadius: 20, overflow: "hidden", height: 120, position: "relative" }}>
              <img src={room.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.3), transparent)" }} />
            </div>
          )}

          {!isInArea ? (
            /* ── AREAS OVERVIEW ── */
            <div>
              <Label>{areas.length} Area{areas.length !== 1 ? "s" : ""}</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {areas.map(function(areaObj) {
                  var an = areaName(areaObj);
                  var ai = areaImg(areaObj);
                  var areaItems = items.filter(function(i) { return i.roomId === roomId && i.area === an; });
                  return (
                    <div key={an} style={Object.assign({}, card, { borderRadius: 18, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column", minHeight: 100, position: "relative" })}>
                      {/* Tappable main area */}
                      <div onClick={function() { setAreaFilter(an); }} style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                        {ai ? (
                          <img src={ai} alt="" style={{ width: 36, height: 36, borderRadius: 12, objectFit: "cover", border: "1px solid " + P.borderL }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 12, background: room.color + "12", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Box size={18} color={room.color} strokeWidth={1.8} />
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, lineHeight: 1.3 }}>{an}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: P.warm, marginTop: 2 }}>{areaItems.length} item{areaItems.length !== 1 ? "s" : ""}</div>
                        </div>
                      </div>
                      {/* Small photo button */}
                      <button onClick={function(e) { e.stopPropagation(); setEditAreaPhoto(an); setEditAreaUrl(ai || ""); }}
                        style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 8, background: "rgba(255,255,255,0.85)", border: "1px solid " + P.borderL, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                        <Camera size={11} color={P.inkMuted} />
                      </button>
                    </div>
                  );
                })}
                {/* Add Area card */}
                <div onClick={function() { setAddArea(true); }}
                  style={{ borderRadius: 18, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 100, border: "2px dashed " + P.border, background: "transparent" }}>
                  <Plus size={20} strokeWidth={2.5} color={P.accent} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: P.accent }}>Add Area</span>
                </div>
              </div>

              {/* All items in this space below the grid */}
              {roomItems.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <Label>All Items in {room ? room.name : ""} ({roomItems.length})</Label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {roomItems.map(function(it) {
                      return (
                        <div key={it.id} onClick={function() { setItemId(it.id); }}
                          style={Object.assign({}, card, { borderRadius: 16, padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" })}>
                          {it.image ? (
                            <img src={it.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", border: "1px solid " + P.borderL }} />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {it.isFolder ? <Folder size={18} color={P.border} /> : <Inbox size={18} color={P.border} />}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                            <div style={{ fontSize: 11, fontWeight: 500, color: P.warm }}>{it.area}</div>
                          </div>
                          {it.isPacked && (
                            <div style={{ width: 22, height: 22, borderRadius: 99, background: P.successSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Package size={10} color={P.success} />
                            </div>
                          )}
                          <ChevronRight size={14} color={P.border} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── INSIDE AN AREA ── */
            <div>
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <Box size={36} color={P.border} style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: P.ink, marginBottom: 4 }}>Nothing in {areaFilter}</div>
                  <div style={{ fontSize: 13, color: P.warm, marginBottom: 20 }}>Add your first item to this area</div>
                  <button onClick={function() { setNiRoom(roomId); setNiArea(areaFilter); setAddItem(true); }} style={Object.assign({}, btn(P.accent, "#fff"), { width: "auto", padding: "10px 24px", display: "inline-block" })}>Add Item</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filtered.map(function(it) {
                    return (
                      <div key={it.id} onClick={function() { setItemId(it.id); }}
                        style={Object.assign({}, card, { borderRadius: 18, padding: 12, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" })}>
                        {it.image ? (
                          <img src={it.image} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover", border: "1px solid " + P.borderL }} />
                        ) : (
                          <div style={{ width: 52, height: 52, borderRadius: 12, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {it.isFolder ? <Folder size={20} color={P.border} /> : <Inbox size={20} color={P.border} />}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                        </div>
                        {it.isPacked && (
                          <div style={{ width: 24, height: 24, borderRadius: 99, background: P.successSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Package size={11} color={P.success} />
                          </div>
                        )}
                        <ChevronRight size={14} color={P.border} />
                      </div>
                    );
                  })}
                </div>
              )}
              <div onClick={function() { setNiRoom(roomId); setNiArea(areaFilter); setAddItem(true); }}
                style={Object.assign({}, cs, { justifyContent: "center", gap: 8, padding: "20px 0", marginTop: 12, borderRadius: 18, border: "2px dashed " + P.border, color: P.warm, fontWeight: 700, fontSize: 14, cursor: "pointer" })}>
                <Plus size={16} strokeWidth={2.5} /> Add Item to {areaFilter}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ══════════════════════ DETAIL (view + edit) ══════════════════════ */
  var renderDetail = function() {
    var hasImg = item && (editing ? editImage : item.image);
    var imgSrc = editing ? editImage : (item ? item.image : "");

    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 40, background: P.surface, display: "flex", flexDirection: "column", animation: "sheetUp 0.35s ease-out" }}>
        {/* Hero image area */}
        <div style={{ position: "relative", height: hasImg ? "40%" : "16%", background: P.canvas }}>
          {hasImg ? <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {item && item.isFolder ? <Folder size={48} color={P.border} strokeWidth={1} /> : <Inbox size={48} color={P.border} strokeWidth={1} />}
            </div>
          )}
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", padding: "48px 16px 0", display: "flex", justifyContent: "space-between", zIndex: 10, background: hasImg ? "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)" : "transparent" }}>
            <button onClick={function() { setItemId(null); setEditing(false); setTagPicker(false); }} style={{ width: 40, height: 40, borderRadius: 99, background: hasImg ? "rgba(255,255,255,0.2)" : P.canvas, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(10px)" }}>
              <ChevronLeft size={18} strokeWidth={2.5} color={hasImg ? "#fff" : P.ink} />
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {!editing && !tagPicker && (
                <button onClick={startEdit} style={{ width: 40, height: 40, borderRadius: 99, background: hasImg ? "rgba(255,255,255,0.2)" : P.canvas, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(10px)" }}>
                  <Edit size={16} color={hasImg ? "#fff" : P.accent} />
                </button>
              )}
              <button onClick={function() { setDelConfirm(item ? item.id : null); }} style={{ width: 40, height: 40, borderRadius: 99, background: hasImg ? "rgba(255,255,255,0.2)" : P.canvas, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(10px)" }}>
                <Trash2 size={16} color={hasImg ? "#fff" : P.danger} />
              </button>
            </div>
          </div>
        </div>

        {/* Content panel */}
        <div style={{ flex: 1, marginTop: -24, borderRadius: "28px 28px 0 0", position: "relative", zIndex: 10, padding: 24, background: P.surface, boxShadow: "0 -8px 30px rgba(0,0,0,0.08)", overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {tagPicker ? (
            /* ── TAG PICKER VIEW ── */
            <div>
              <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: P.ink }}>Manage Tags</h2>
              <TagPicker
                allTags={allTags}
                selectedTags={item ? (item.tags || []) : []}
                onToggle={toggleItemTag}
                onCreate={createAndAddTag}
                onClose={function() { setTagPicker(false); }}
              />
            </div>
          ) : editing ? (
            /* ── EDIT MODE ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: P.ink }}>Edit Item</h2>
                <button onClick={function() { setEditing(false); }} style={{ fontSize: 14, fontWeight: 700, color: P.warm, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              </div>

              <div><FieldLabel>Name *</FieldLabel><Input value={editName} onChange={function(e) { setEditName(e.target.value); }} placeholder="Item name" /></div>
              <ImageInput value={editImage} onChange={setEditImage} label="Photo" />
              <div><FieldLabel>Value ($)</FieldLabel><Input value={editValue} onChange={function(e) { setEditValue(e.target.value); }} placeholder="0" type="number" /></div>
              <div>
                <FieldLabel>Notes</FieldLabel>
                <textarea value={editNotes} onChange={function(e) { setEditNotes(e.target.value); }} placeholder="Serial number, purchase info..." rows={3}
                  style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, padding: "12px 16px", fontSize: 15, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit", resize: "none" }} />
              </div>
              <button onClick={saveEdit} style={btn(editName.trim() ? P.accent : P.border, "#fff")}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Save size={16} /> Save Changes</span>
              </button>
            </div>
          ) : (
            /* ── VIEW MODE ── */
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: P.ink, letterSpacing: -0.3 }}>{item ? item.name : ""}</h1>
                  {item && (item.value || item.isPriceless) && (
                    <div style={{ fontSize: 14, fontWeight: 600, color: P.warm, marginTop: 4 }}>
                      {item.isPriceless ? "Priceless" : "$" + item.value}
                    </div>
                  )}
                </div>
                <button onClick={function() { if (item) { togglePack(item.id); flash(item.isPacked ? "Removed from bag" : "Added to bag!"); } }}
                  style={{ width: 48, height: 48, borderRadius: 16, border: item && item.isPacked ? "none" : "1.5px solid " + P.border, background: item && item.isPacked ? P.success : P.canvas, color: item && item.isPacked ? "#fff" : P.warm, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Package size={20} strokeWidth={2} />
                </button>
              </div>

              <div style={{ borderRadius: 16, padding: 16, marginBottom: 14, background: P.canvas, border: "1px solid " + P.borderL }}>
                <FieldLabel>Location</FieldLabel>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: P.ink }}>
                  <MapPin size={15} color={P.accent} />
                  <span>{item ? getRoomName(item.roomId) : ""}</span>
                  <ChevronRight size={12} color={P.border} />
                  <span style={{ color: P.inkMuted }}>{item ? item.area : ""}</span>
                </div>
              </div>

              {item && item.notes ? (
                <div style={{ borderRadius: 16, padding: 16, marginBottom: 14, background: P.canvas, border: "1px solid " + P.borderL }}>
                  <FieldLabel>Notes</FieldLabel>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: P.inkSoft }}>{item.notes}</p>
                </div>
              ) : null}

              <div style={{ marginBottom: 20 }}>
                <FieldLabel>Tags</FieldLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {item && item.tags ? item.tags.map(function(t) {
                    return (
                      <span key={t} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 700, background: P.canvas, color: P.inkSoft, border: "1px solid " + P.borderL }}>
                        <Tag size={11} /> {t}
                      </span>
                    );
                  }) : null}
                  <span onClick={function() { setTagPicker(true); }} style={{ padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 700, color: P.accent, border: "1.5px dashed rgba(232,101,43,0.3)", background: P.accentSoft, cursor: "pointer" }}>+ Add</span>
                </div>
              </div>

              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={startEdit} style={Object.assign({}, btn(P.accentSoft, P.accent), { border: "1px solid rgba(232,101,43,0.15)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 })}>
                  <Edit size={15} /> Edit Item
                </button>
                <button onClick={function() { setMoveItem(true); }} style={Object.assign({}, btn(P.canvas, P.ink), { border: "1px solid " + P.border, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 })}>
                  <ArrowRight size={15} /> Move to another space
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ══════════════════════ SEARCH ══════════════════════ */
  var renderSearch = function() {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas }}>
        <div style={{ padding: "48px 24px 16px", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid " + P.borderL, position: "sticky", top: 0, zIndex: 20 }}>
          <h1 style={{ margin: "0 0 16px", fontSize: 28, fontWeight: 900, color: P.ink }}>Search</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={16} color={P.warm} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input autoFocus value={q} onChange={function(e) { setQ(e.target.value); }} placeholder="Items, tags, or spaces..."
                style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, padding: "12px 36px 12px 40px", fontSize: 15, fontWeight: 500, outline: "none", border: "1.5px solid " + (q ? P.accent : P.border), background: P.canvas, color: P.ink, fontFamily: "inherit" }} />
              {q && <button onClick={function() { setQ(""); }} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}><X size={14} color={P.warm} /></button>}
            </div>
            <button onClick={function() { setGridView(!gridView); }} style={{ width: 44, height: 44, borderRadius: 14, background: P.canvas, border: "1px solid " + P.border, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {gridView ? <List size={16} color={P.inkMuted} /> : <Grid size={16} color={P.inkMuted} />}
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
          {!q ? (
            <div>
              <Label>Popular Tags</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                {allTags.map(function(t) { return <button key={t} onClick={function() { setQ(t); }} style={{ padding: "8px 16px", borderRadius: 99, fontSize: 13, fontWeight: 700, background: P.surface, color: P.inkMuted, border: "1px solid " + P.border, cursor: "pointer", fontFamily: "inherit" }}>#{t}</button>; })}
              </div>
              <Label>All Items ({items.length})</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map(function(it) {
                  return (
                    <div key={it.id} onClick={function() { setItemId(it.id); }} style={Object.assign({}, card, { borderRadius: 14, padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" })}>
                      {it.image ? <img src={it.image} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} /> : <div style={{ width: 40, height: 40, borderRadius: 10, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}><Inbox size={16} color={P.border} /></div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: P.warm }}>{getRoomName(it.roomId)} · {it.area}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : searched.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: P.warm }}>
              <Search size={32} color={P.border} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>No results</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Nothing matches "{q}"</div>
            </div>
          ) : !gridView ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {searched.map(function(it) {
                return (
                  <div key={it.id} onClick={function() { setItemId(it.id); }} style={Object.assign({}, card, { borderRadius: 14, padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" })}>
                    {it.image ? <img src={it.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} /> : <div style={{ width: 44, height: 44, borderRadius: 10, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}><Inbox size={16} color={P.border} /></div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: P.warm }}>{getRoomName(it.roomId)} · {it.area}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {searched.map(function(it) {
                return (
                  <div key={it.id} onClick={function() { setItemId(it.id); }} style={Object.assign({}, card, { borderRadius: 16, overflow: "hidden", cursor: "pointer" })}>
                    <div style={{ aspectRatio: "1", background: P.canvas, position: "relative" }}>
                      {it.image ? <img src={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Inbox size={24} color={P.border} /></div>}
                      {it.isPacked && <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 99, background: P.success, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={10} color="#fff" /></div>}
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: P.warm, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{getRoomName(it.roomId)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ══════════════════════ PACKING ══════════════════════ */
  var renderPacking = function() {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas }}>
        <div style={{ padding: "48px 24px 16px", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid " + P.borderL }}>
          <h1 style={{ margin: "0 0 16px", fontSize: 28, fontWeight: 900, color: P.ink }}>Packing</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={pill(false)}>All Packed <span style={{ marginLeft: 6, background: P.canvas, padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 900 }}>{packed.length}</span></button>
            <button style={pill(true)}>Weekend Trip</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
          <div style={{ borderRadius: 22, padding: 22, marginBottom: 20, position: "relative", overflow: "hidden", background: "linear-gradient(135deg, " + P.ink + ", " + P.inkSoft + ")" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 12, position: "relative", zIndex: 1 }}>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>Pack Progress</span>
              <span style={{ color: "#fff" }}>{packed.length} of {items.length}</span>
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 99, background: "rgba(255,255,255,0.1)", position: "relative", zIndex: 1 }}>
              <div style={{ height: 8, borderRadius: 99, background: P.accent, width: Math.min((packed.length / Math.max(items.length, 1)) * 100, 100) + "%", transition: "width 0.7s ease-out", boxShadow: "0 0 12px rgba(232,101,43,0.5)" }} />
            </div>
            <button onClick={loadTemplate} style={{ width: "100%", padding: "10px 0", marginTop: 16, borderRadius: 14, fontSize: 13, fontWeight: 700, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", position: "relative", zIndex: 1, fontFamily: "inherit" }}>Load Template</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map(function(it) {
              return (
                <div key={it.id} style={Object.assign({}, card, { borderRadius: 16, padding: 8, display: "flex", alignItems: "center" })}>
                  <button onClick={function() { togglePack(it.id); flash(it.isPacked ? "Unpacked" : "Packed!"); }}
                    style={{ padding: 10, background: "none", border: "none", cursor: "pointer", color: it.isPacked ? P.success : P.border, display: "flex", alignItems: "center" }}>
                    {it.isPacked ? <CheckCircle size={22} strokeWidth={2.5} /> : <div style={{ width: 22, height: 22, borderRadius: 99, border: "2px solid " + P.border }} />}
                  </button>
                  <div style={{ flex: 1, opacity: it.isPacked ? 0.35 : 1, transition: "opacity 0.3s", cursor: "pointer" }} onClick={function() { setItemId(it.id); }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, textDecoration: it.isPacked ? "line-through" : "none" }}>{it.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: P.warm }}>{getRoomName(it.roomId)} · {it.area}</div>
                  </div>
                  {it.image && <img src={it.image} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", marginRight: 4, opacity: it.isPacked ? 0.25 : 1, filter: it.isPacked ? "grayscale(1)" : "none" }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════════════ SETTINGS ══════════════════════ */
  var renderSettings = function() {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas, overflowY: "auto", paddingBottom: 120 }}>
        <div style={{ padding: "48px 24px 8px" }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: P.ink }}>Settings</h1>
        </div>
        <div style={{ padding: "20px 20px 0" }}>
          <Label>Organization</Label>
          <div style={Object.assign({}, card, { overflow: "hidden", marginBottom: 20 })}>
            {[{ icon: Tag, label: "Manage Tags", sub: allTags.length + " tags" }, { icon: Bookmark, label: "Backup & Export", sub: "Last: today" }].map(function(x, i) {
              return (
                <div key={x.label} onClick={function() { flash(x.label + " opened"); }} style={Object.assign({}, cs, { justifyContent: "space-between", padding: "14px 20px", cursor: "pointer", borderBottom: i === 0 ? "1px solid " + P.borderL : "none" })}>
                  <div style={Object.assign({}, cs, { gap: 14 })}>
                    <div style={{ width: 36, height: 36, borderRadius: 12, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}><x.icon size={16} color={P.inkMuted} /></div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{x.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: P.warm }}>{x.sub}</div>
                    </div>
                  </div>
                  <ChevronRight size={14} color={P.border} />
                </div>
              );
            })}
          </div>
          <Label>About</Label>
          <div style={Object.assign({}, card, { padding: 24, textAlign: "center" })}>
            <div style={{ fontSize: 20, fontWeight: 900, color: P.ink }}>Stow<span style={{ color: P.accent }}>.</span></div>
            <div style={{ fontSize: 12, fontWeight: 600, color: P.warm, marginTop: 4 }}>Version 3.0</div>
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════════════ SCANNER ══════════════════════ */
  var renderScanner = function() {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "#000", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px 0", color: "#fff", position: "relative", zIndex: 10, background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)" }}>
          <button onClick={function() { setScanner(false); }} style={{ width: 40, height: 40, borderRadius: 99, background: "rgba(255,255,255,0.2)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(10px)" }}><X size={16} color="#fff" /></button>
          <span style={{ fontWeight: 800, letterSpacing: 2, fontSize: 11, textTransform: "uppercase", color: "#fff" }}>Quick Scan</span>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <img src="https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.6, transform: "scale(1.05)", filter: "blur(2px)" }} />
          </div>
          <div style={{ width: "75%", aspectRatio: "1", border: "2.5px solid rgba(232,101,43,0.5)", borderRadius: 28, position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}>
            <Camera size={48} color="rgba(232,101,43,0.4)" />
            <div style={{ position: "absolute", top: -40, color: "#fff", fontWeight: 700, fontSize: 12, background: "rgba(0,0,0,0.5)", padding: "6px 16px", borderRadius: 99, backdropFilter: "blur(10px)" }}>Point at an item</div>
          </div>
        </div>
        <div style={{ height: 140, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 32, position: "relative", zIndex: 10 }}>
          <button onClick={doScan} style={{ width: 72, height: 72, borderRadius: 99, border: "4px solid #fff", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <div style={{ width: 58, height: 58, borderRadius: 99, background: P.accent }} />
          </button>
        </div>
      </div>
    );
  };

  /* ══════════════════════ MAIN RENDER ══════════════════════ */
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#0A0A0F", fontFamily: "-apple-system, system-ui, sans-serif" }}>
      <style>{"\n@keyframes sheetUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }\n@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }\n.no-scrollbar::-webkit-scrollbar { display:none; } .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }\n"}</style>

      <div style={{ position: "relative", width: "100%", maxWidth: 400, height: 850, background: P.surface, borderRadius: 44, boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 25px 80px rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", flexDirection: "column", border: "12px solid #1A1A2E" }}>

        <div style={{ height: 56, position: "absolute", top: 0, width: "100%", zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 28px 0", pointerEvents: "none" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: scanner || itemId ? "#fff" : P.ink }}>9:41</span>
          <div style={{ width: 20, height: 14, borderRadius: 4, border: "1.5px solid " + (scanner || itemId ? "#fff" : P.ink), position: "relative" }}>
            <div style={{ position: "absolute", top: 2, left: 2, bottom: 2, width: "70%", borderRadius: 1, background: scanner || itemId ? "#fff" : P.ink }} />
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", position: "relative", marginTop: 16 }}>
          {tab === "home" && renderHome()}
          {tab === "search" && renderSearch()}
          {tab === "bags" && renderPacking()}
          {tab === "settings" && renderSettings()}
        </div>

        {!itemId && !scanner && (
          <div style={{ position: "absolute", bottom: 100, right: 20, zIndex: 40 }}>
            {fabOpen && (
              <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8, animation: "sheetUp 0.2s ease-out" }}>
                <button onClick={function() { setFabOpen(false); setScanner(true); }} style={Object.assign({}, cs, { gap: 10, padding: "12px 18px", borderRadius: 18, background: P.ink, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", fontFamily: "inherit" })}>
                  <Camera size={16} /> Scan Item
                </button>
                <button onClick={function() { setFabOpen(false); setAddItem(true); }} style={Object.assign({}, cs, { gap: 10, padding: "12px 18px", borderRadius: 18, background: P.ink, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", fontFamily: "inherit" })}>
                  <Edit size={16} /> Add Manually
                </button>
              </div>
            )}
            <button onClick={function() { setFabOpen(!fabOpen); }} style={{ width: 56, height: 56, borderRadius: 99, background: P.accent, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(232,101,43,0.4)", transform: fabOpen ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>
              <Plus size={26} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {!itemId && !scanner && (
          <div style={{ height: 88, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(24px)", borderTop: "1px solid " + P.borderL, padding: "12px 24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "absolute", bottom: 0, width: "100%", zIndex: 30, boxSizing: "border-box" }}>
            <NavBtn icon={Home} label="Spaces" active={tab === "home"} onClick={function() { setTab("home"); setRoomId(null); setItemId(null); }} />
            <NavBtn icon={Search} label="Search" active={tab === "search"} onClick={function() { setTab("search"); }} />
            <NavBtn icon={Package} label="Packing" active={tab === "bags"} onClick={function() { setTab("bags"); }} badge={packed.length > 0 ? packed.length : null} />
            <NavBtn icon={Settings} label="Settings" active={tab === "settings"} onClick={function() { setTab("settings"); }} />
          </div>
        )}

        {scanner && renderScanner()}

        {/* ── ADD ITEM SHEET ── */}
        <Sheet open={addItem} onClose={function() { setAddItem(false); }} title="Add Item">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><FieldLabel>Name *</FieldLabel><Input value={niName} onChange={function(e) { setNiName(e.target.value); }} placeholder="e.g. Blue backpack" /></div>
            <ImageInput value={niImage} onChange={setNiImage} label="Photo" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <FieldLabel>Space</FieldLabel>
                <select value={niRoom || roomId || ""} onChange={function(e) { setNiRoom(e.target.value); setNiArea(""); }}
                  style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, padding: "12px 12px", fontSize: 14, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit" }}>
                  <option value="">Select...</option>
                  {rooms.map(function(r) { return <option key={r.id} value={r.id}>{r.name}</option>; })}
                </select>
              </div>
              <div>
                <FieldLabel>Area</FieldLabel>
                <select value={niArea} onChange={function(e) { setNiArea(e.target.value); }}
                  style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, padding: "12px 12px", fontSize: 14, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit" }}>
                  <option value="">Select...</option>
                  {(rooms.find(function(r) { return r.id === (niRoom || roomId); }) || { areas: [] }).areas.map(function(a) { return <option key={areaName(a)} value={areaName(a)}>{areaName(a)}</option>; })}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><FieldLabel>Value ($)</FieldLabel><Input value={niVal} onChange={function(e) { setNiVal(e.target.value); }} placeholder="0" type="number" /></div>
              <div><FieldLabel>Tags</FieldLabel><Input value={niTags} onChange={function(e) { setNiTags(e.target.value); }} placeholder="Tech, Travel" /></div>
            </div>
            <div>
              <FieldLabel>Notes</FieldLabel>
              <textarea value={niNotes} onChange={function(e) { setNiNotes(e.target.value); }} placeholder="Serial number, purchase info..." rows={2}
                style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, padding: "12px 16px", fontSize: 15, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit", resize: "none" }} />
            </div>
            <button onClick={doAddItem} style={btn(niName.trim() ? P.accent : P.border, "#fff")}>Add Item</button>
          </div>
        </Sheet>

        {/* ── ADD SPACE SHEET ── */}
        <Sheet open={addSpace} onClose={function() { setAddSpace(false); }} title="New Space">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><FieldLabel>Name *</FieldLabel><Input value={nsName} onChange={function(e) { setNsName(e.target.value); }} placeholder="e.g. Bedroom, Attic" /></div>
            <ImageInput value={nsImage} onChange={setNsImage} label="Space Photo" />
            <div><FieldLabel>Areas (comma-separated)</FieldLabel><Input value={nsAreas} onChange={function(e) { setNsAreas(e.target.value); }} placeholder="Shelf, Drawer, Closet" /></div>
            <button onClick={doAddSpace} style={btn(nsName.trim() ? P.accent : P.border, "#fff")}>Create Space</button>
          </div>
        </Sheet>

        {/* ── MOVE ITEM SHEET ── */}
        <Sheet open={moveItem} onClose={function() { setMoveItem(false); }} title="Move Item">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {rooms.map(function(rm) {
              var isSameRoom = item ? rm.id === item.roomId : false;
              var availableAreas = isSameRoom ? rm.areas.filter(function(a) { return item ? areaName(a) !== item.area : true; }) : rm.areas;
              if (availableAreas.length === 0) return null;
              return (
                <div key={rm.id}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, marginBottom: 8 }}>
                    {rm.name}{isSameRoom ? " (current space)" : ""}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {availableAreas.map(function(a) { return <button key={areaName(a)} onClick={function() { doMove(rm.id, areaName(a)); }} style={{ padding: "8px 16px", borderRadius: 14, fontSize: 13, fontWeight: 700, background: P.canvas, color: P.inkMuted, border: "1px solid " + P.border, cursor: "pointer", fontFamily: "inherit" }}>{areaName(a)}</button>; })}
                  </div>
                </div>
              );
            })}
          </div>
        </Sheet>

        {/* ── ADD AREA SHEET ── */}
        <Sheet open={addArea} onClose={function() { setAddArea(false); }} title="New Area">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: P.warm }}>Adding to <span style={{ color: P.ink, fontWeight: 700 }}>{room ? room.name : ""}</span></div>
            <div><FieldLabel>Area Name *</FieldLabel><Input value={naName} onChange={function(e) { setNaName(e.target.value); }} placeholder="e.g. Top Shelf, Drawer 2, Box A" /></div>
            <ImageInput value={naImage} onChange={setNaImage} label="Area Photo" />
            <button onClick={doAddArea} style={btn(naName.trim() ? P.accent : P.border, "#fff")}>Add Area</button>
          </div>
        </Sheet>

        {/* ── EDIT SPACE PHOTO SHEET ── */}
        <Sheet open={editSpacePhoto} onClose={function() { setEditSpacePhoto(false); }} title="Space Photo">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: P.warm }}>Set photo for <span style={{ color: P.ink, fontWeight: 700 }}>{room ? room.name : ""}</span></div>
            {editSpaceUrl && (
              <div style={{ borderRadius: 16, overflow: "hidden", height: 140 }}>
                <img src={editSpaceUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div>
              <FieldLabel>Image URL</FieldLabel>
              <input value={editSpaceUrl} onChange={function(e) { setEditSpaceUrl(e.target.value); }} placeholder="Paste image URL..."
                style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, padding: "12px 16px", fontSize: 14, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {editSpaceUrl && (
                <button onClick={function() { setEditSpaceUrl(""); }} style={Object.assign({}, btn(P.dangerSoft, P.danger), { flex: 1 })}>Remove</button>
              )}
              <button onClick={saveSpacePhoto} style={Object.assign({}, btn(P.accent, "#fff"), { flex: 1 })}>Save</button>
            </div>
          </div>
        </Sheet>

        {/* ── EDIT AREA PHOTO SHEET ── */}
        <Sheet open={!!editAreaPhoto} onClose={function() { setEditAreaPhoto(null); }} title="Area Photo">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: P.warm }}>Set photo for <span style={{ color: P.ink, fontWeight: 700 }}>{editAreaPhoto || ""}</span></div>
            {editAreaUrl && (
              <div style={{ borderRadius: 16, overflow: "hidden", height: 140 }}>
                <img src={editAreaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div>
              <FieldLabel>Image URL</FieldLabel>
              <input value={editAreaUrl} onChange={function(e) { setEditAreaUrl(e.target.value); }} placeholder="Paste image URL..."
                style={{ width: "100%", boxSizing: "border-box", borderRadius: 14, padding: "12px 16px", fontSize: 14, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {editAreaUrl && (
                <button onClick={function() { setEditAreaUrl(""); }} style={Object.assign({}, btn(P.dangerSoft, P.danger), { flex: 1 })}>Remove</button>
              )}
              <button onClick={saveAreaPhoto} style={Object.assign({}, btn(P.accent, "#fff"), { flex: 1 })}>Save</button>
            </div>
          </div>
        </Sheet>

        {/* ── DELETE CONFIRM ── */}
        {delConfirm && (
          <div style={{ position: "absolute", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
            <div onClick={function() { setDelConfirm(null); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }} />
            <div style={{ position: "relative", background: "#fff", width: "100%", borderRadius: 24, padding: 28, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", animation: "sheetUp 0.25s ease-out" }}>
              <div style={{ width: 56, height: 56, borderRadius: 99, background: P.dangerSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Trash2 size={22} color={P.danger} />
              </div>
              <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: P.ink }}>Delete this item?</h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: P.warm }}>This can't be undone.</p>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={function() { setDelConfirm(null); }} style={Object.assign({}, btn(P.canvas, P.ink), { flex: 1 })}>Cancel</button>
                <button onClick={function() { doDelete(delConfirm); }} style={Object.assign({}, btn(P.danger, "#fff"), { flex: 1 })}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* ── QR LABEL ── */}
        {qrLabel && (
          <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div onClick={function() { setQrLabel(false); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }} />
            <div style={{ position: "relative", background: "#fff", width: "100%", borderRadius: 28, padding: 32, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", animation: "sheetUp 0.25s ease-out" }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Grid size={24} color={P.ink} /></div>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: P.ink }}>{room ? room.name : ""}</h2>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: P.warm }}>Print this label and stick it on your space.</p>
              <div style={{ border: "3px solid " + P.ink, padding: 8, borderRadius: 20, display: "inline-block", marginBottom: 24 }}>
                <img src={"https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=stowapp://space/" + (room ? room.id : "")} alt="QR" style={{ width: 140, height: 140, display: "block" }} />
              </div>
              <br />
              <button onClick={function() { flash("Label sent to printer!"); setQrLabel(false); }} style={btn(P.accent, "#fff")}>Print Label</button>
            </div>
          </div>
        )}

        {/* ── TOAST ── */}
        {toast && (
          <div style={{ position: "absolute", top: 64, left: 0, right: 0, zIndex: 60, display: "flex", justifyContent: "center", pointerEvents: "none", animation: "sheetUp 0.3s ease-out" }}>
            <div style={{ background: "rgba(26,26,46,0.92)", backdropFilter: "blur(16px)", color: "#fff", padding: "10px 22px", borderRadius: 20, fontWeight: 700, fontSize: 13, letterSpacing: 0.3, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>{toast}</div>
          </div>
        )}
      </div>
    </div>
  );
}
