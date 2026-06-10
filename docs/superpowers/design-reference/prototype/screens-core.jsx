/* Stow core screens: Spaces, Room (areas + items), Search.
   Each screen is a component taking a shared context `c`. Exported to window.StowScreens. */

/* ----------------------------------------------------------------------------
   SpacesScreen — the home. Two variants, switched by the `homeStyle` tweak:
     "retrieval" (default) → search-first home built for finding & filing
     "value"               → the original value-hero home, preserved intact
---------------------------------------------------------------------------- */
function SpacesScreen({ c }) {
  return c.t.homeStyle === "value"
    ? <ValueFirstHome c={c} />
    : <RetrievalHome c={c} />;
}

/* Retrieval-first home: prominent "Find anything…" search on top, live inline
   results, a Recently-added rail, then the spaces list. */
function RetrievalHome({ c }) {
  const { P, I, U, rooms, items, q, act } = c;
  const roomName = (rid) => { const r = rooms.find((x) => x.id === rid); return r ? r.name : ""; };
  const ql = q.trim().toLowerCase();
  const searching = ql.length > 0;
  const results = searching
    ? items.filter((i) =>
        i.name.toLowerCase().includes(ql) ||
        (i.tags || []).some((t) => t.toLowerCase().includes(ql)) ||
        roomName(i.roomId).toLowerCase().includes(ql) ||
        (i.area || "").toLowerCase().includes(ql))
    : [];
  const recent = items
    .slice()
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 8);
  const total = items.reduce((s, i) => s + (i.value || 0), 0);

  /* one result / item row, shared by results list */
  const resultRow = (it) => (
    <div key={it.id} onClick={() => act.openItem(it.id)}
      style={{ ...U.cardStyle(P), borderRadius: P.radius + 4, padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
      {it.image ? (
        <img src={it.image} alt="" style={{ width: 46, height: 46, borderRadius: 11, objectFit: "cover", border: "1px solid " + P.borderL, flexShrink: 0 }} />
      ) : (
        <div style={{ width: 46, height: 46, borderRadius: 11, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {it.isFolder ? <I.Folder size={18} color={P.warm} /> : <I.Inbox size={18} color={P.warm} />}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <I.MapPin size={10} color={P.warm} style={{ verticalAlign: "-1px", marginRight: 3 }} />{roomName(it.roomId)} · {it.area}
        </div>
      </div>
      <I.ChevronRight size={15} color={P.border} />
    </div>
  );

  /* recently-added thumbnail card */
  const recentCard = (it) => (
    <div key={it.id} onClick={() => act.openItem(it.id)}
      style={{ ...U.cardStyle(P), width: 132, flexShrink: 0, borderRadius: P.radius + 6, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ height: 94, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {it.image ? (
          <img src={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (it.isFolder ? <I.Folder size={26} color={P.border} /> : <I.Inbox size={26} color={P.border} />)}
      </div>
      <div style={{ padding: "9px 11px 11px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: P.warm, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{roomName(it.roomId)}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas }}>
      <div style={{ padding: "56px 24px 14px", background: P.surface + "E6", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid " + P.borderL, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: P.ink, letterSpacing: -0.5, fontFamily: "var(--stow-display)" }}>Stow<span style={{ color: P.accent }}>.</span></h1>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: P.warm }}>{items.length} items · {rooms.length} spaces · ${total.toLocaleString()} tracked</p>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 99, background: P.surface, border: "1px solid " + P.borderL, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: P.shadowSoft }}>
            <I.Bell size={18} color={P.inkMuted} />
          </div>
        </div>
        {/* search hero */}
        <div style={{ position: "relative" }}>
          <I.Search size={18} color={searching ? P.accent : P.warm} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={(e) => act.setQ(e.target.value)} placeholder="Find anything…"
            style={{ width: "100%", boxSizing: "border-box", borderRadius: P.radius + 6, padding: "15px 44px 15px 46px", fontSize: 16, fontWeight: 600, outline: "none", border: "1.5px solid " + (searching ? P.accent : P.border), background: P.canvas, color: P.ink, fontFamily: "inherit", boxShadow: searching ? "0 0 0 4px " + P.accentSoft : P.shadowSoft }} />
          {searching && (
            <button onClick={() => act.setQ("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: 99, background: P.border, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <I.X size={13} color={P.inkMuted} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 150px" }}>
        {searching ? (
          results.length === 0 ? (
            <div style={{ textAlign: "center", padding: "52px 20px", color: P.warm }}>
              <I.Search size={30} color={P.border} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15.5, fontWeight: 700, color: P.ink }}>No matches</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Nothing matches “{q}”</div>
            </div>
          ) : (
            <div>
              <U.Label P={P}>{results.length} result{results.length !== 1 ? "s" : ""}</U.Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{results.map(resultRow)}</div>
            </div>
          )
        ) : (
          <React.Fragment>
            {/* recently added */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, marginLeft: 2 }}>
              <I.Clock size={13} color={P.warm} strokeWidth={2.2} />
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: P.warm }}>Recently added</span>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "2px 24px 14px", margin: "0 -24px", marginBottom: 12 }}>
              {recent.map(recentCard)}
            </div>
            <window.StowScreens.SpacesManagedList c={c} />
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

/* Original value-first home — preserved for side-by-side comparison. */
function ValueFirstHome({ c }) {
  const { P, I, U, rooms, items, act } = c;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas }}>
      <div style={{ padding: "56px 24px 8px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: P.ink, letterSpacing: -0.5, fontFamily: "var(--stow-display)" }}>Stow<span style={{ color: P.accent }}>.</span></h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: P.warm }}>{items.length} items across {rooms.length} spaces</p>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 99, background: P.surface, border: "1px solid " + P.borderL, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: P.shadowSoft }}>
            <I.Bell size={18} color={P.inkMuted} />
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 150px" }}>
        {/* value summary card */}
        <div style={{ marginTop: 18, marginBottom: 22, padding: 18, borderRadius: P.radius + 8, background: "linear-gradient(135deg, " + P.accent + ", color-mix(in srgb, " + P.accent + " 70%, #000))", color: "#fff", boxShadow: "0 10px 26px " + P.accent + "44" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.85 }}>Estimated Value</div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4, letterSpacing: -0.5 }}>${items.reduce((s, i) => s + (i.value || 0), 0).toLocaleString()}</div>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>{items.filter((i) => i.tags && i.tags.includes("Important")).length} flagged important · insured</div>
        </div>
        <window.StowScreens.SpacesManagedList c={c} />
      </div>
    </div>
  );
}

function RoomScreen({ c }) {
  const { P, I, U, rooms, items, roomId, areaFilter, act } = c;
  const room = rooms.find((r) => r.id === roomId);
  const isInArea = areaFilter !== "All";
  const areas = room ? room.areas : [];
  const roomItems = items.filter((i) => i.roomId === roomId);
  const filtered = isInArea ? roomItems.filter((i) => i.area === areaFilter) : roomItems;

  const itemRow = (it, big) => (
    <div key={it.id} onClick={() => act.openItem(it.id)}
      style={{ ...U.cardStyle(P), borderRadius: P.radius + 4, padding: big ? 12 : 10, display: "flex", alignItems: "center", gap: big ? 14 : 12, cursor: "pointer" }}>
      {it.image ? (
        <img src={it.image} alt="" style={{ width: big ? 52 : 44, height: big ? 52 : 44, borderRadius: 12, objectFit: "cover", border: "1px solid " + P.borderL }} />
      ) : (
        <div style={{ width: big ? 52 : 44, height: big ? 52 : 44, borderRadius: 12, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {it.isFolder ? <I.Folder size={20} color={P.warm} /> : <I.Inbox size={20} color={P.warm} />}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: big ? 15 : 14, fontWeight: 700, color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
        {!isInArea && <div style={{ fontSize: 11, fontWeight: 500, color: P.warm, marginTop: 1 }}>{it.area}</div>}
      </div>
      {it.isPacked && (
        <div style={{ width: 24, height: 24, borderRadius: 99, background: P.successSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <I.Package size={11} color={P.success} />
        </div>
      )}
      <I.ChevronRight size={14} color={P.border} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas }}>
      <div style={{ padding: "56px 14px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: P.surface + "E6", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid " + P.borderL, position: "sticky", top: 0, zIndex: 20 }}>
        <button onClick={() => (isInArea ? act.setAreaFilter("All") : act.backFromRoom())}
          style={{ display: "flex", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: P.accent, fontWeight: 700, fontSize: 15, padding: "8px 4px", fontFamily: "inherit" }}>
          <I.ChevronLeft size={20} strokeWidth={2.5} color={P.accent} /> {isInArea ? (room ? room.name : "") : "Spaces"}
        </button>
        <span style={{ fontSize: 17, fontWeight: 800, color: P.ink }}>{isInArea ? areaFilter : (room ? room.name : "")}</span>
        <div style={{ display: "flex", gap: 2 }}>
          <button onClick={() => act.flash("Camera ready")} style={{ padding: 8, background: "none", border: "none", cursor: "pointer" }}><I.Camera size={18} color={P.inkMuted} /></button>
          <button onClick={() => act.flash("QR labels generated")} style={{ padding: 8, background: "none", border: "none", cursor: "pointer" }}><I.QrCode size={18} color={P.inkMuted} /></button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 150px" }}>
        {!isInArea ? (
          <div>
            <U.Label P={P}>{areas.length} Area{areas.length !== 1 ? "s" : ""}</U.Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {areas.map((areaObj) => {
                const an = areaObj.name;
                const areaItems = items.filter((i) => i.roomId === roomId && i.area === an);
                return (
                  <div key={an} onClick={() => act.setAreaFilter(an)}
                    style={{ ...U.cardStyle(P), borderRadius: P.radius + 4, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, minHeight: 104 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: (room ? room.color : P.accent) + "16", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <I.Box size={18} color={room ? room.color : P.accent} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, lineHeight: 1.3 }}>{an}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: P.warm, marginTop: 2 }}>{areaItems.length} item{areaItems.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                );
              })}
              <div onClick={() => act.setSheet("addArea")}
                style={{ borderRadius: P.radius + 4, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 104, border: "2px dashed " + P.border }}>
                <I.Plus size={20} strokeWidth={2.5} color={P.accent} />
                <span style={{ fontSize: 13, fontWeight: 700, color: P.accent }}>Add Area</span>
              </div>
            </div>

            {roomItems.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <U.Label P={P}>All Items ({roomItems.length})</U.Label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {roomItems.map((it) => itemRow(it, false))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <I.Box size={36} color={P.border} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: P.ink, marginBottom: 4 }}>Nothing in {areaFilter}</div>
                <div style={{ fontSize: 13, color: P.warm, marginBottom: 20 }}>Add your first item to this area</div>
                <button onClick={() => act.startAddItem()} style={{ padding: "10px 24px", borderRadius: P.radius + 6, fontWeight: 700, fontSize: 14, border: "none", background: P.accent, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>Add Item</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered.map((it) => itemRow(it, true))}
              </div>
            )}
            <div onClick={() => act.startAddItem()}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 0", marginTop: 12, borderRadius: P.radius + 4, border: "2px dashed " + P.border, color: P.warm, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              <I.Plus size={16} strokeWidth={2.5} color={P.warm} /> Add Item to {areaFilter}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchScreen({ c }) {
  const { P, I, U, items, rooms, q, gridView, act } = c;
  const allTags = Array.from(new Set(items.flatMap((i) => i.tags || [])));
  const roomName = (rid) => { const r = rooms.find((x) => x.id === rid); return r ? r.name : ""; };
  const searched = q ? items.filter((i) => {
    const ql = q.toLowerCase();
    return i.name.toLowerCase().includes(ql) || (i.tags || []).some((t) => t.toLowerCase().includes(ql)) || roomName(i.roomId).toLowerCase().includes(ql);
  }) : [];
  const listToShow = q ? searched : items;

  const row = (it) => (
    <div key={it.id} onClick={() => act.openItem(it.id)} style={{ ...U.cardStyle(P), borderRadius: P.radius + 2, padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
      {it.image ? <img src={it.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} /> : <div style={{ width: 44, height: 44, borderRadius: 10, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>{it.isFolder ? <I.Folder size={16} color={P.warm} /> : <I.Inbox size={16} color={P.warm} />}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: P.warm }}>{roomName(it.roomId)} · {it.area}</div>
      </div>
      {it.value ? <span style={{ fontSize: 12, fontWeight: 700, color: P.inkMuted }}>${it.value}</span> : null}
    </div>
  );
  const gridCard = (it) => (
    <div key={it.id} onClick={() => act.openItem(it.id)} style={{ ...U.cardStyle(P), borderRadius: P.radius + 4, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ aspectRatio: "1", background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {it.image ? <img src={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (it.isFolder ? <I.Folder size={28} color={P.border} /> : <I.Inbox size={28} color={P.border} />)}
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: P.warm, marginTop: 1 }}>{roomName(it.roomId)}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas }}>
      <div style={{ padding: "56px 24px 16px", background: P.surface + "E6", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid " + P.borderL, position: "sticky", top: 0, zIndex: 20 }}>
        <h1 style={{ margin: "0 0 16px", fontSize: 28, fontWeight: 900, color: P.ink, fontFamily: "var(--stow-display)" }}>Search</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <I.Search size={16} color={P.warm} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input autoFocus value={q} onChange={(e) => act.setQ(e.target.value)} placeholder="Items, tags, or spaces..."
              style={{ width: "100%", boxSizing: "border-box", borderRadius: P.radius + 2, padding: "12px 36px 12px 40px", fontSize: 15, fontWeight: 500, outline: "none", border: "1.5px solid " + (q ? P.accent : P.border), background: P.canvas, color: P.ink, fontFamily: "inherit" }} />
            {q && <button onClick={() => act.setQ("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}><I.X size={14} color={P.warm} /></button>}
          </div>
          <button onClick={() => act.setGridView(!gridView)} style={{ width: 44, height: 44, borderRadius: P.radius + 2, background: P.canvas, border: "1px solid " + P.border, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {gridView ? <I.List size={16} color={P.inkMuted} /> : <I.Grid size={16} color={P.inkMuted} />}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 150px" }}>
        {!q && (
          <div style={{ marginBottom: 22 }}>
            <U.Label P={P}>Popular Tags</U.Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {allTags.map((t) => <button key={t} onClick={() => act.setQ(t)} style={{ padding: "8px 16px", borderRadius: 99, fontSize: 13, fontWeight: 700, background: P.surface, color: P.inkMuted, border: "1px solid " + P.border, cursor: "pointer", fontFamily: "inherit" }}>#{t}</button>)}
            </div>
          </div>
        )}
        {q && searched.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: P.warm }}>
            <I.Search size={32} color={P.border} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>No results</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Nothing matches "{q}"</div>
          </div>
        ) : (
          <div>
            <U.Label P={P}>{q ? searched.length + " result" + (searched.length !== 1 ? "s" : "") : "All Items (" + items.length + ")"}</U.Label>
            {gridView ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{listToShow.map(gridCard)}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{listToShow.map(row)}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  StowScreens: Object.assign(window.StowScreens || {}, { SpacesScreen, RoomScreen, SearchScreen }),
});
