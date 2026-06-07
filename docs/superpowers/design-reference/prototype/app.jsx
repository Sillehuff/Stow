/* Stow main App: state, actions, sheets, tweaks. Mounts inside IOSDevice. */
const { useState, useMemo, useEffect, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#E8652B",
  "dark": false,
  "display": "\"Clash Display\", \"SF Pro Display\", system-ui",
  "body": "\"Inter Tight\", -apple-system, system-ui",
  "radius": 12,
  "wallpaper": false,
  "addFlow": "cameraFirst",
  "homeStyle": "retrieval",
  "itemPriority": "location"
}/*EDITMODE-END*/;

function StowApp() {
  const I = window.StowIcons, U = window.StowUI, S = window.StowScreens;
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const P = useMemo(() => window.makePalette(t.accent, t.dark, t.radius), [t.accent, t.dark, t.radius]);

  // data
  const [items, setItems] = useState(window.StowData.ITEMS);
  const [rooms, setRooms] = useState(window.StowData.ROOMS);
  const [packingLists, setPackingLists] = useState(window.StowData.PACKING_LISTS);
  const members = window.StowData.MEMBERS;

  // navigation
  const [tab, setTab] = useState("spaces");
  const [roomId, setRoomId] = useState(null);
  const [areaFilter, setAreaFilter] = useState("All");
  const [itemId, setItemId] = useState(null);
  const [activeListId, setActiveListId] = useState(null);
  const [q, setQ] = useState("");
  const [gridView, setGridView] = useState(false);

  // overlays
  const [sheet, setSheet] = useState(null); // addItem | addSpace | addArea
  const [delId, setDelId] = useState(null);
  const [scan, setScan] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [quickCap, setQuickCap] = useState(false); // "capture a whole shot" batch flow
  const [toast, setToast] = useState(null);
  const [photo, setPhoto] = useState(null); // { target:"new"|"edit", mode:"camera"|"library", ai:bool }
  const [addCapture, setAddCapture] = useState(null); // camera-first add: { mode:"photo"|"ai" }

  // edit
  const [editing, setEditing] = useState(false);
  const [edit, setEditState] = useState({ name: "", image: "", value: "", notes: "" });

  // spaces management (Option D)
  const [spaceMenuId, setSpaceMenuId] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [editSpace, setEditSpace] = useState(null); // { id, name, color, icon, areas:[{key,name}] }
  const [delSpaceId, setDelSpaceId] = useState(null);
  const areaKey = useRef(0);

  // sheet form fields
  const [form, setForm] = useState({ name: "", roomId: "", area: "", value: "", tags: "", notes: "", image: "", areas: "" });
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const [moreOpen, setMoreOpen] = useState(false); // "More details" disclosure in Add Item

  // default Space/Area for a new item, inferred from where the user is
  const locDefaults = () => {
    const r = roomId || (rooms[0] && rooms[0].id) || "";
    const rm = rooms.find((x) => x.id === r);
    const a = areaFilter !== "All" ? areaFilter : (rm && rm.areas[0] ? rm.areas[0].name : "");
    return { roomId: r, area: a };
  };

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };
  const packedCount = useMemo(() => packingLists.reduce((s, l) => s + (l.itemIds.length - l.packedItemIds.length), 0), [packingLists]);

  const act = {
    setTab, setSheet, setAreaFilter, setQ, setGridView, flash,
    openRoom: (id) => { setRoomId(id); setAreaFilter("All"); },
    backFromRoom: () => setRoomId(null),
    openItem: (id) => setItemId(id),
    closeItem: () => { setItemId(null); setEditing(false); },
    openList: (id) => setActiveListId(id),
    backToLists: () => setActiveListId(null),
    togglePack: (id) => setItems((prev) => prev.map((i) => i.id === id ? { ...i, isPacked: !i.isPacked } : i)),
    toggleListItem: (lid, iid) => setPackingLists((prev) => prev.map((l) => {
      if (l.id !== lid) return l;
      const has = l.packedItemIds.includes(iid);
      return { ...l, packedItemIds: has ? l.packedItemIds.filter((x) => x !== iid) : l.packedItemIds.concat([iid]) };
    })),
    clearList: (lid) => { setPackingLists((prev) => prev.map((l) => l.id === lid ? { ...l, packedItemIds: [] } : l)); flash("List reset"); },
    askDelete: (id) => setDelId(id),
    // ---- spaces management (Option D) ----
    reorderSpaces: (arr) => setRooms(arr),
    openSpaceMenu: (id) => setSpaceMenuId(id),
    closeSpaceMenu: () => setSpaceMenuId(null),
    startRename: (id) => { const rm = rooms.find((r) => r.id === id); setSpaceMenuId(null); setRenameId(id); setRenameValue(rm ? rm.name : ""); },
    setRenameValue: (v) => setRenameValue(v),
    commitRename: () => { setRooms((prev) => prev.map((r) => r.id === renameId ? { ...r, name: renameValue.trim() || r.name } : r)); setRenameId(null); if (renameValue.trim()) flash("Space renamed"); },
    cancelRename: () => setRenameId(null),
    openEditSpace: (id) => { const rm = rooms.find((r) => r.id === id); if (!rm) return; setSpaceMenuId(null); setEditSpace({ id, name: rm.name, color: rm.color, icon: rm.icon, areas: rm.areas.map((a) => ({ key: "ak" + (areaKey.current++), name: a.name })) }); },
    closeEditSpace: () => setEditSpace(null),
    setEditSpaceField: (k, v) => setEditSpace((p) => ({ ...p, [k]: v })),
    addEditArea: () => setEditSpace((p) => ({ ...p, areas: p.areas.concat([{ key: "ak" + (areaKey.current++), name: "New Area" }]) })),
    removeEditArea: (key) => setEditSpace((p) => ({ ...p, areas: p.areas.filter((a) => a.key !== key) })),
    renameEditArea: (key, v) => setEditSpace((p) => ({ ...p, areas: p.areas.map((a) => a.key === key ? { ...a, name: v } : a) })),
    reorderEditAreas: (arr) => setEditSpace((p) => ({ ...p, areas: arr })),
    saveEditSpace: () => {
      setEditSpace((p) => {
        if (!p || !p.name.trim()) return p;
        setRooms((prev) => prev.map((r) => r.id === p.id ? { ...r, name: p.name.trim(), color: p.color, icon: p.icon, areas: p.areas.map((a) => ({ name: a.name.trim() || "Area" })) } : r));
        flash("Space updated");
        return null;
      });
    },
    askDeleteSpace: (id) => { setSpaceMenuId(null); setDelSpaceId(id); },
    doDeleteSpace: () => {
      const id = delSpaceId;
      const removed = items.filter((i) => i.roomId === id).map((i) => i.id);
      setItems((prev) => prev.filter((i) => i.roomId !== id));
      setPackingLists((prev) => prev.map((l) => ({ ...l, itemIds: l.itemIds.filter((x) => !removed.includes(x)), packedItemIds: l.packedItemIds.filter((x) => !removed.includes(x)) })));
      setRooms((prev) => prev.filter((r) => r.id !== id));
      setEditSpace((p) => (p && p.id === id ? null : p));
      if (roomId === id) setRoomId(null);
      setDelSpaceId(null); flash("Space deleted");
    },
    startEdit: () => { const it = items.find((i) => i.id === itemId); if (!it) return; setEditState({ name: it.name, image: it.image || "", value: it.value ? String(it.value) : "", notes: it.notes || "" }); setEditing(true); },
    cancelEdit: () => setEditing(false),
    setEdit: (k, v) => setEditState((p) => ({ ...p, [k]: v })),
    saveEdit: () => {
      if (!edit.name.trim()) return;
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, name: edit.name.trim(), image: edit.image || undefined, value: edit.value ? parseFloat(edit.value) : 0, notes: edit.notes } : i));
      setEditing(false); flash("Item updated");
    },
    toggleItemTag: (tag) => setItems((prev) => prev.map((i) => {
      if (i.id !== itemId) return i;
      const tags = i.tags || [];
      return { ...i, tags: tags.includes(tag) ? tags.filter((x) => x !== tag) : tags.concat([tag]) };
    })),
    closeScan: () => { setScan(false); setScanning(false); },
    startQuickCapture: () => { setScan(false); setScanning(false); setQuickCap(true); },
    closeQuickCapture: () => setQuickCap(false),
    commitCapture: (newItems) => {
      setItems((prev) => prev.concat(newItems));
      setQuickCap(false);
      flash(newItems.length + " item" + (newItems.length !== 1 ? "s" : "") + " filed");
    },
    startAddItem: () => { setForm((p) => ({ ...p, ...locDefaults() })); setMoreOpen(false); if (t.addFlow === "cameraFirst") setAddCapture({ mode: "photo" }); else setSheet("addItem"); },
    closeAddCapture: () => setAddCapture(null),
    skipCapture: () => { setAddCapture(null); setSheet("addItem"); },
    captureResult: (url, meta) => {
      setForm((p) => ({ ...p, image: url, aiFilled: !!meta, ...(meta ? { name: meta.name, value: meta.value, tags: meta.tags } : {}) }));
      if (meta) setMoreOpen(true);
      setAddCapture(null); setSheet("addItem");
      if (meta) flash("Identified & filled in");
    },
    openPhoto: (target, mode, ai) => setPhoto({ target, mode, ai: !!ai }),
    closePhoto: () => setPhoto(null),
    removePhoto: (target) => { if (target === "edit") setEditState((p) => ({ ...p, image: "" })); else setForm((p) => ({ ...p, image: "", aiFilled: false })); },
    applyPhoto: (url, meta) => {
      if (photo && photo.target === "edit") {
        setEditState((p) => ({ ...p, image: url, ...(meta ? { name: meta.name, value: meta.value } : {}) }));
      } else {
        setForm((p) => ({ ...p, image: url, aiFilled: !!meta, ...(meta ? { name: meta.name, value: meta.value, tags: meta.tags } : {}) }));
        if (meta) setMoreOpen(true);
      }
      setPhoto(null);
      flash(meta ? "Identified & filled in" : "Photo added");
    },
    doScan: () => {
      setScanning(true);
      setTimeout(() => {
        const r = roomId || "r1"; const rm = rooms.find((x) => x.id === r);
        const n = { id: "i" + Date.now(), name: "Sony WH-1000XM5", roomId: r, area: rm ? rm.areas[0].name : "TV Stand", isPacked: false, image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80", value: 250, tags: ["Tech", "Audio"], notes: "Identified by AI", createdAt: "2026-05-31" };
        setItems((prev) => prev.concat([n]));
        setScanning(false); setScan(false); setItemId(n.id); flash("Item identified & added");
      }, 1700);
    },
  };

  const doAddItem = () => {
    if (!form.name.trim()) return;
    const r = form.roomId || roomId || rooms[0].id; const rm = rooms.find((x) => x.id === r);
    const a = form.area || (areaFilter !== "All" ? areaFilter : (rm && rm.areas[0] ? rm.areas[0].name : ""));
    const n = { id: "i" + Date.now(), name: form.name.trim(), roomId: r, area: a, isPacked: false, image: form.image || undefined, value: form.value ? parseFloat(form.value) : 0, tags: form.tags ? form.tags.split(",").map((x) => x.trim()).filter(Boolean) : [], notes: form.notes, createdAt: "2026-05-31" };
    setItems((prev) => prev.concat([n]));
    setSheet(null); setMoreOpen(false); setForm({ name: "", roomId: "", area: "", value: "", tags: "", notes: "", image: "", areas: "" }); flash("Item added");
  };
  const doAddSpace = () => {
    if (!form.name.trim()) return;
    const areaList = form.areas ? form.areas.split(",").map((a) => ({ name: a.trim() })).filter((a) => a.name) : [{ name: "Main" }];
    const colors = ["#E8652B", "#2D9F6F", "#5B6ABF", "#C4883A", "#B0479A"];
    setRooms((prev) => prev.concat([{ id: "r" + Date.now(), name: form.name.trim(), icon: "Box", color: colors[prev.length % colors.length], image: "", areas: areaList }]));
    setSheet(null); setForm({ name: "", roomId: "", area: "", value: "", tags: "", notes: "", image: "", areas: "" }); flash("Space created");
  };
  const doAddArea = () => {
    if (!form.name.trim() || !roomId) return;
    setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, areas: r.areas.concat([{ name: form.name.trim() }]) } : r));
    setSheet(null); setForm({ name: "", roomId: "", area: "", value: "", tags: "", notes: "", image: "", areas: "" }); flash("Area added");
  };
  const doDelete = () => {
    setItems((prev) => prev.filter((i) => i.id !== delId));
    setPackingLists((prev) => prev.map((l) => ({ ...l, itemIds: l.itemIds.filter((x) => x !== delId), packedItemIds: l.packedItemIds.filter((x) => x !== delId) })));
    setDelId(null); setItemId(null); setEditing(false); flash("Item deleted");
  };

  const c = { P, I, U, t, items, rooms, packingLists, members, tab, roomId, areaFilter, itemId, activeListId, q, gridView, editing, edit, scanning, photo, addCapture, act, tweaks: t, spaceMgmt: { menuId: spaceMenuId, renameId, renameValue, edit: editSpace } };

  // which screen
  let screen;
  if (tab === "spaces") screen = roomId ? <S.RoomScreen c={c} /> : <S.SpacesScreen c={c} />;
  else if (tab === "search") screen = <S.SearchScreen c={c} />;
  else if (tab === "packing") screen = <S.PackingScreen c={c} />;
  else if (tab === "settings") screen = <S.SettingsScreen c={c} />;

  const itemSheetField = (label, key, ph, type) => (
    <div style={{ marginBottom: 14 }}><U.FieldLabel P={P}>{label}</U.FieldLabel><U.Input P={P} value={form[key]} onChange={(e) => setF(key, e.target.value)} placeholder={ph} type={type} /></div>
  );

  return (
    <div className="stow-root" style={{ fontFamily: t.body, color: P.ink, "--stow-display": t.display }}>
      <div className="device-scale">
      <window.IOSDevice dark={t.dark}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: P.canvas }}>
          {t.wallpaper && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(110% 60% at 0% 0%, " + P.accent + "22, transparent 60%)", pointerEvents: "none" }} />}
          {screen}
          {itemId && <S.ItemDetail c={c} />}
          {scan && <S.ScanOverlay c={c} />}
          {quickCap && <S.QuickCapture c={c} />}
          {photo && <S.PhotoSource c={c} />}
          {addCapture && <S.CaptureFirst c={c} />}
          {!itemId && !scan && <U.BottomNav P={P} tab={tab} setTab={(k) => { setTab(k); setRoomId(null); setActiveListId(null); }} onScan={() => setScan(true)} packedCount={packedCount} />}

          {/* Add Item sheet */}
          <U.Sheet P={P} open={sheet === "addItem"} onClose={() => setSheet(null)} title="Add Item">
            {(() => {
              const locFirst = t.itemPriority === "location";
              const nameField = itemSheetField("Name", "name", "e.g. Wireless Charger");
              const valueField = itemSheetField("Value ($)", "value", "0", "number");
              const tagsField = itemSheetField("Tags (comma separated)", "tags", "Tech, Travel");
              const photoBlock = (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <U.FieldLabel P={P}>Photo</U.FieldLabel>
                    {form.aiFilled && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: P.accent, background: P.accentSoft, padding: "3px 8px", borderRadius: 99, marginBottom: 6 }}>
                        <I.Sparkles size={10} color={P.accent} /> AI filled
                      </span>
                    )}
                  </div>
                  <S.PhotoField P={P} I={I} value={form.image} target="new" act={act} />
                </div>
              );
              const notesBlock = (
                <div style={{ marginBottom: 18 }}>
                  <U.FieldLabel P={P}>Notes</U.FieldLabel>
                  <textarea value={form.notes} onChange={(e) => setF("notes", e.target.value)} rows={2} placeholder="Serial, purchase info..." style={{ width: "100%", boxSizing: "border-box", borderRadius: P.radius + 2, padding: "12px 16px", fontSize: 15, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit", resize: "none" }} />
                </div>
              );

              // --- Space / Area picker (location-first only) ---
              const selRoom = rooms.find((r) => r.id === form.roomId) || rooms[0];
              const spaceAreaBlock = (
                <div style={{ marginBottom: 16 }}>
                  <U.FieldLabel P={P}>Space</U.FieldLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {rooms.map((rm) => {
                      const sel = (form.roomId || (selRoom && selRoom.id)) === rm.id;
                      return (
                        <button key={rm.id} type="button" onClick={() => setForm((p) => ({ ...p, roomId: rm.id, area: rm.areas[0] ? rm.areas[0].name : "" }))}
                          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 13px", borderRadius: P.radius, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", border: "1.5px solid " + (sel ? rm.color : P.border), background: sel ? "color-mix(in srgb, " + rm.color + " 12%, " + P.surface + ")" : P.canvas, color: sel ? P.ink : P.inkMuted }}>
                          <span style={{ width: 9, height: 9, borderRadius: 99, background: rm.color, flexShrink: 0 }} />
                          {rm.name}
                        </button>
                      );
                    })}
                  </div>
                  <U.FieldLabel P={P}>Area in {selRoom ? selRoom.name : ""}</U.FieldLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {(selRoom ? selRoom.areas : []).map((a) => {
                      const sel = form.area === a.name;
                      return (
                        <button key={a.name} type="button" onClick={() => setF("area", a.name)}
                          style={{ padding: "8px 14px", borderRadius: P.radius, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", border: "1.5px solid " + (sel ? P.accent : P.border), background: sel ? P.accent : P.canvas, color: sel ? "#fff" : P.inkMuted }}>
                          {a.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );

              // --- collapsed "More details": Value, Tags, Notes ---
              const filledHints = [form.value ? "$" + form.value : null, form.tags ? (form.tags.split(",").filter((x) => x.trim()).length + " tag" + (form.tags.split(",").filter((x) => x.trim()).length !== 1 ? "s" : "")) : null].filter(Boolean);
              const moreDetails = (
                <div style={{ marginTop: 4, marginBottom: 16, borderTop: "1px solid " + P.borderL }}>
                  <button type="button" onClick={() => setMoreOpen(!moreOpen)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 12px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: P.inkSoft }}>More details</span>
                      {!moreOpen && filledHints.length > 0 && (
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: P.warm }}>{filledHints.join(" · ")}</span>
                      )}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {!moreOpen && filledHints.length === 0 && <span style={{ fontSize: 12, fontWeight: 600, color: P.warm }}>Value, tags, notes</span>}
                      <I.ChevronDown size={17} color={P.inkMuted} style={{ transform: moreOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                    </span>
                  </button>
                  {moreOpen && <div>{valueField}{tagsField}{notesBlock}</div>}
                </div>
              );

              if (locFirst) {
                // Photo is captured first in camera-first flow; either way photo leads, then Name, then Space/Area.
                return <React.Fragment>{photoBlock}{nameField}{spaceAreaBlock}{moreDetails}</React.Fragment>;
              }
              // Original price-forward order — preserved intact.
              return t.addFlow === "cameraFirst" ? (
                <React.Fragment>{photoBlock}{nameField}{valueField}{tagsField}{notesBlock}</React.Fragment>
              ) : (
                <React.Fragment>{nameField}{photoBlock}{valueField}{tagsField}{notesBlock}</React.Fragment>
              );
            })()}
            <U.Button P={P} bg={form.name.trim() ? P.accent : P.border} color="#fff" onClick={doAddItem}><I.Plus size={16} color="#fff" /> Add Item</U.Button>
          </U.Sheet>

          {/* Add Space sheet */}
          <U.Sheet P={P} open={sheet === "addSpace"} onClose={() => setSheet(null)} title="Add Space">
            {itemSheetField("Space name", "name", "e.g. Bedroom")}
            {itemSheetField("Areas (comma separated)", "areas", "Closet, Nightstand, Dresser")}
            <div style={{ height: 6 }} />
            <U.Button P={P} bg={form.name.trim() ? P.accent : P.border} color="#fff" onClick={doAddSpace}><I.Plus size={16} color="#fff" /> Create Space</U.Button>
          </U.Sheet>

          {/* Add Area sheet */}
          <U.Sheet P={P} open={sheet === "addArea"} onClose={() => setSheet(null)} title="Add Area">
            {itemSheetField("Area name", "name", "e.g. Top Shelf")}
            <div style={{ height: 6 }} />
            <U.Button P={P} bg={form.name.trim() ? P.accent : P.border} color="#fff" onClick={doAddArea}><I.Plus size={16} color="#fff" /> Add Area</U.Button>
          </U.Sheet>

          {/* Spaces management overlays (Option D) */}
          {spaceMenuId && <S.SpaceActionSheet c={c} />}
          {editSpace && <S.EditSpaceSheet c={c} />}
          <U.Confirm P={P} open={!!delSpaceId} title="Delete space?" body="This removes the space and all of its items from your inventory and any packing lists. This can't be undone." confirmLabel="Delete Space" onConfirm={act.doDeleteSpace} onCancel={() => setDelSpaceId(null)} />

          <U.Confirm P={P} open={!!delId} title="Delete item?" body="This removes it from your inventory and any packing lists. This can't be undone." confirmLabel="Delete" onConfirm={doDelete} onCancel={() => setDelId(null)} />
          <U.Toast P={P} msg={toast} />
        </div>
      </window.IOSDevice>
      </div>

      {/* Tweaks */}
      <window.TweaksPanel>
        <window.TweakSection label="Home screen" />
        <window.TweakRadio label="Layout" value={t.homeStyle}
          options={[{ value: "retrieval", label: "Retrieval-first" }, { value: "value", label: "Value-first" }]}
          onChange={(v) => setTweak("homeStyle", v)} />
        <window.TweakSection label="Add Item flow" />
        <window.TweakRadio label="Entry point" value={t.addFlow}
          options={[{ value: "cameraFirst", label: "Camera-first" }, { value: "field", label: "Photo field" }]}
          onChange={(v) => setTweak("addFlow", v)} />
        <window.TweakSection label="Item hierarchy" />
        <window.TweakRadio label="Lead with" value={t.itemPriority}
          options={[{ value: "location", label: "Location" }, { value: "price", label: "Price" }]}
          onChange={(v) => setTweak("itemPriority", v)} />
        <window.TweakSection label="Theme" />
        <window.TweakColor label="Accent" value={t.accent} options={["#E8652B", "#2A6FDB", "#1F8A5B", "#7A5AE0", "#D6336C"]} onChange={(v) => setTweak("accent", v)} />
        <window.TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        <window.TweakToggle label="Accent wallpaper glow" value={t.wallpaper} onChange={(v) => setTweak("wallpaper", v)} />
        <window.TweakSection label="Shape" />
        <window.TweakSlider label="Corner radius" value={t.radius} min={6} max={22} step={1} unit="px" onChange={(v) => setTweak("radius", v)} />
        <window.TweakSection label="Type" />
        <window.TweakSelect label="Display font" value={t.display}
          options={[
            { value: "\"Clash Display\", \"SF Pro Display\", system-ui", label: "Clash Display" },
            { value: "\"Space Grotesk\", system-ui", label: "Space Grotesk" },
            { value: "\"Fraunces\", Georgia, serif", label: "Fraunces" },
            { value: "\"Inter Tight\", system-ui", label: "Inter Tight" },
          ]}
          onChange={(v) => setTweak("display", v)} />
        <window.TweakSelect label="Body font" value={t.body}
          options={[
            { value: "\"Inter Tight\", -apple-system, system-ui", label: "Inter Tight" },
            { value: "\"SF Pro Text\", system-ui", label: "SF Pro Text" },
            { value: "\"Geist\", system-ui", label: "Geist" },
            { value: "\"Space Grotesk\", system-ui", label: "Space Grotesk" },
          ]}
          onChange={(v) => setTweak("body", v)} />
      </window.TweaksPanel>
    </div>
  );
}

window.StowApp = StowApp;
