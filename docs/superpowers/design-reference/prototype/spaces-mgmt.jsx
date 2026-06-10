/* Stow — Spaces management (Option D synthesis, wired live).
   - ReorderList: scale-aware vertical drag-to-reorder (long-press OR grip handle)
   - SpacesManagedList: the Spaces list with ··· menu, inline rename, hold-to-drag
   - SpaceActionSheet: iOS-style quick actions (Edit / Rename / Delete)
   - EditSpaceSheet: full editor — name, color, icon, areas (reorder/add/delete), delete
   Exported onto window.StowScreens. */

const { useRef: useRefM, useState: useStateM, useEffect: useEffectM } = React;

/* ----------------------------------------------------------------------------
   ReorderList — uniform-height vertical reorder that survives device scaling.
   Math is done in *screen* px for index detection (scale cancels) and converted
   to local px for the lifted-row transform.
---------------------------------------------------------------------------- */
function ReorderList({ items, idOf, onReorder, gap = 0, mode = "longpress", longPressMs = 300, renderRow }) {
  const [order, setOrder] = useStateM(items);
  const [dragId, setDragId] = useStateM(null);
  const [, force] = useStateM(0);
  const wrapRef = useRefM(null);
  const slotEls = useRefM({});
  const orderRef = useRefM(items);
  const S = useRefM({});

  // keep local order synced with external data when not mid-drag
  useEffectM(() => { if (!S.current.id) { setOrder(items); orderRef.current = items; } }, [items]);
  orderRef.current = order;

  const stepPx = () => S.current.step || 1;

  function beginDrag(id, clientY) {
    const wrap = wrapRef.current;
    const rowEl = slotEls.current[id];
    if (!wrap || !rowEl) return;
    const wrapRect = wrap.getBoundingClientRect();
    const scale = wrapRect.height / wrap.offsetHeight || 1;
    const H = rowEl.offsetHeight + gap;
    const i0 = orderRef.current.findIndex((x) => idOf(x) === id);
    const startPy = (clientY - wrapRect.top) / scale;
    const grab = startPy - i0 * H;
    S.current = { id, wrapTop: wrapRect.top, scale, step: H, grab, desiredTop: i0 * H, move: onMove, up: onUp };
    setDragId(id);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function onMove(e) {
    const s = S.current; if (!s.id) return;
    if (e.cancelable) e.preventDefault();
    const py = (e.clientY - s.wrapTop) / s.scale;
    const desiredTop = py - s.grab;
    s.desiredTop = desiredTop;
    const prev = orderRef.current;
    const n = prev.length;
    const cur = prev.findIndex((x) => idOf(x) === s.id);
    let ni = Math.round(desiredTop / s.step);
    ni = Math.max(0, Math.min(n - 1, ni));
    if (ni !== cur) {
      const next = prev.slice();
      const [it] = next.splice(cur, 1);
      next.splice(ni, 0, it);
      orderRef.current = next;
      setOrder(next);
    } else {
      force((v) => v + 1); // re-render to update lifted transform
    }
  }

  function onUp() {
    const s = S.current;
    window.removeEventListener("pointermove", s.move);
    window.removeEventListener("pointerup", s.up);
    window.removeEventListener("pointercancel", s.up);
    s.suppressClick = true;
    setTimeout(() => { S.current.suppressClick = false; }, 280);
    const dropped = orderRef.current;
    S.current = { suppressClick: s.suppressClick };
    setDragId(null);
    if (onReorder) onReorder(dropped);
  }

  // long-press arming (whole-row mode)
  function armLongPress(id, e) {
    if (mode !== "longpress") return;
    const sx = e.clientX, sy = e.clientY;
    let cancelled = false;
    const pre = (ev) => { if (Math.abs(ev.clientY - sy) > 9 || Math.abs(ev.clientX - sx) > 9) cleanup(); };
    const cleanup = () => { cancelled = true; clearTimeout(timer); window.removeEventListener("pointermove", pre); window.removeEventListener("pointerup", cleanup); window.removeEventListener("pointercancel", cleanup); };
    const timer = setTimeout(() => {
      window.removeEventListener("pointermove", pre);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      if (!cancelled) { try { navigator.vibrate && navigator.vibrate(8); } catch (_) {} beginDrag(id, sy); }
    }, longPressMs);
    window.addEventListener("pointermove", pre);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {order.map((it, idx) => {
        const id = idOf(it);
        const dragging = id === dragId;
        const lifted = dragging
          ? { transform: "translateY(" + (S.current.desiredTop - idx * stepPx()) + "px) scale(1.025)", zIndex: 50, position: "relative", boxShadow: "0 18px 40px rgba(0,0,0,0.20)", borderRadius: 14 }
          : { opacity: dragId ? 0.55 : 1, transition: dragId ? "opacity .15s" : "none" };
        const handleProps = mode === "handle"
          ? { onPointerDown: (e) => { e.stopPropagation(); beginDrag(id, e.clientY); } }
          : {};
        return (
          <div key={id}
            ref={(el) => { if (el) slotEls.current[id] = el; }}
            onPointerDown={(e) => armLongPress(id, e)}
            onClickCapture={(e) => { if (S.current.suppressClick) { e.stopPropagation(); e.preventDefault(); } }}
            style={{ touchAction: dragging ? "none" : "auto", ...lifted }}>
            {renderRow(it, { dragging, anyDragging: !!dragId, handleProps })}
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Reusable grip glyph
---------------------------------------------------------------------------- */
function Grip({ c }) {
  const col = c || "#C9C9D4";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      {[6, 12, 18].map((y) => (
        <React.Fragment key={y}>
          <circle cx="9" cy={y} r="1.4" fill={col} /><circle cx="15" cy={y} r="1.4" fill={col} />
        </React.Fragment>
      ))}
    </svg>
  );
}

/* ----------------------------------------------------------------------------
   SpacesManagedList — drop-in replacement for the Spaces card body
---------------------------------------------------------------------------- */
function SpacesManagedList({ c }) {
  const { P, I, U, rooms, items, act, spaceMgmt } = c;
  const renaming = spaceMgmt.renameId;

  const renderRow = (rm, { dragging, anyDragging }) => {
    const Ic = I[rm.icon] || I.Box;
    const cnt = items.filter((i) => i.roomId === rm.id).length;
    const isRenaming = renaming === rm.id;
    return (
      <div
        onClick={() => { if (!isRenaming && !anyDragging) act.openRoom(rm.id); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 14px 18px", cursor: dragging ? "grabbing" : "pointer", borderBottom: "1px solid " + P.borderL, background: dragging ? P.surface : "transparent" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
          {rm.image ? (
            <img src={rm.image} alt="" style={{ width: 44, height: 44, borderRadius: 14, objectFit: "cover", border: "1px solid " + P.borderL, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: rm.color + "1A", flexShrink: 0 }}>
              <Ic size={20} strokeWidth={1.9} color={rm.color} />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            {isRenaming ? (
              <input autoFocus value={spaceMgmt.renameValue}
                onChange={(e) => act.setRenameValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === "Enter") act.commitRename(); if (e.key === "Escape") act.cancelRename(); }}
                onBlur={() => act.commitRename()}
                style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid " + P.accent, borderRadius: 9, padding: "7px 10px", fontSize: 15.5, fontWeight: 700, color: P.ink, outline: "none", background: P.canvas, fontFamily: "inherit" }} />
            ) : (
              <React.Fragment>
                <div style={{ fontSize: 16, fontWeight: 700, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rm.name}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: P.warm, marginTop: 2, whiteSpace: "nowrap" }}>{rm.areas.length} areas · {cnt} item{cnt !== 1 ? "s" : ""}</div>
              </React.Fragment>
            )}
          </div>
        </div>
        {isRenaming ? (
          <button onClick={(e) => { e.stopPropagation(); act.commitRename(); }} style={{ marginLeft: 10, padding: "7px 14px", borderRadius: 99, border: "none", background: P.accent, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Done</button>
        ) : dragging ? (
          <Grip c={P.accent} />
        ) : (
          <button onClick={(e) => { e.stopPropagation(); act.openSpaceMenu(rm.id); }}
            style={{ width: 32, height: 32, borderRadius: 99, border: "1px solid transparent", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <I.MoreHorizontal size={18} color={P.warm} />
          </button>
        )}
      </div>
    );
  };

  return (
    <React.Fragment>
      <U.Label P={P}>Your Spaces</U.Label>
      <div style={{ ...U.cardStyle(P), overflow: "hidden" }}>
        <ReorderList items={rooms} idOf={(r) => r.id} mode="longpress" onReorder={(arr) => act.reorderSpaces(arr)} renderRow={renderRow} />
        <div onClick={() => act.setSheet("addSpace")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, cursor: "pointer", borderTop: "1px solid " + P.borderL, color: P.accent, fontWeight: 700, fontSize: 14 }}>
          <I.Plus size={16} strokeWidth={2.5} color={P.accent} /> Add Space
        </div>
      </div>
      <div style={{ marginTop: 13, display: "flex", flexDirection: "column", gap: 7, fontSize: 11.5, color: P.warm, fontWeight: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}><I.MoreHorizontal size={14} color={P.warm} /> Tap ··· to edit, rename, or delete a space.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Grip c={P.warm} /> Touch &amp; hold a row to drag it into order.</div>
      </div>
    </React.Fragment>
  );
}

/* ----------------------------------------------------------------------------
   SpaceActionSheet — iOS quick-actions for one space
---------------------------------------------------------------------------- */
function SpaceActionSheet({ c }) {
  const { P, I, rooms, items, spaceMgmt, act } = c;
  const rm = rooms.find((r) => r.id === spaceMgmt.menuId);
  if (!rm) return null;
  const cnt = items.filter((i) => i.roomId === rm.id).length;
  const rows = [
    { icon: <I.Settings size={19} color={P.accent} />, label: "Edit space", tint: true, bold: true, onClick: () => act.openEditSpace(rm.id) },
    { icon: <I.Edit size={19} color={P.accent} />, label: "Rename", tint: true, onClick: () => act.startRename(rm.id) },
    { icon: <I.Trash2 size={19} color={P.danger} />, label: "Delete space", danger: true, onClick: () => act.askDeleteSpace(rm.id) },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 75, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={act.closeSpaceMenu} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)", animation: "stowPop .2s ease-out" }} />
      <div style={{ position: "relative", padding: "0 10px 12px", animation: "stowUp .26s ease-out" }}>
        <div style={{ background: "rgba(255,255,255,0.93)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: 18, overflow: "hidden", boxShadow: "0 12px 36px rgba(0,0,0,0.18)" }}>
          <div style={{ textAlign: "center", padding: "15px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: P.ink }}>{rm.name}</div>
            <div style={{ fontSize: 12, color: P.warm, marginTop: 2 }}>{rm.areas.length} areas · {cnt} item{cnt !== 1 ? "s" : ""}</div>
          </div>
          {rows.map((r, i) => (
            <button key={i} onClick={r.onClick}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "16px 18px", fontSize: 17, fontWeight: r.bold ? 700 : 500, color: r.danger ? P.danger : (r.tint ? P.accent : P.inkSoft), border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.07)" }}>
              {r.icon}{r.label}
            </button>
          ))}
        </div>
        <button onClick={act.closeSpaceMenu} style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(24px)", border: "none", borderRadius: 18, textAlign: "center", padding: "16px 18px", fontSize: 17, fontWeight: 800, color: P.accent, boxShadow: "0 12px 36px rgba(0,0,0,0.14)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   EditSpaceSheet — full editor (name, color, icon, areas, delete)
---------------------------------------------------------------------------- */
function EditSpaceSheet({ c }) {
  const { P, I, spaceMgmt, act } = c;
  const ed = spaceMgmt.edit;
  if (!ed) return null;
  const SWATCHES = ["#E8652B", "#2D9F6F", "#5B6ABF", "#C4883A", "#B0479A", "#2A6FDB", "#D6336C"];
  const ICON_CHOICES = ["Home", "Coffee", "Briefcase", "Box", "Package", "Folder", "Bell", "Star"];
  const HeadIcon = I[ed.icon] || I.Box;

  const areaRow = (a, { dragging, handleProps }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: "1px solid " + P.borderL, background: dragging ? P.surface : P.canvas }}>
      <span {...handleProps} style={{ cursor: "grab", display: "flex", touchAction: "none", padding: "2px 0" }}><Grip c={P.border} /></span>
      <input value={a.name} onChange={(e) => act.renameEditArea(a.key, e.target.value)}
        style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontSize: 14.5, fontWeight: 600, color: P.ink, outline: "none", fontFamily: "inherit" }} />
      <button onClick={() => act.removeEditArea(a.key)} style={{ width: 26, height: 26, borderRadius: 8, background: P.dangerSoft, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        <I.Trash2 size={13} color={P.danger} />
      </button>
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 78, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={act.closeEditSpace} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "relative", background: P.surface, borderRadius: "28px 28px 0 0", boxShadow: "0 -10px 40px rgba(0,0,0,0.18)", maxHeight: "92%", display: "flex", flexDirection: "column", animation: "stowUp 0.3s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 2 }}>
          <div style={{ width: 36, height: 5, borderRadius: 99, background: P.border }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 22px 12px", borderBottom: "1px solid " + P.borderL }}>
          <button onClick={act.closeEditSpace} style={{ background: "none", border: "none", fontSize: 15, fontWeight: 600, color: P.warm, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Cancel</button>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: P.ink, margin: 0 }}>Edit Space</h2>
          <button onClick={act.saveEditSpace} style={{ background: "none", border: "none", fontSize: 15, fontWeight: 800, color: ed.name.trim() ? P.accent : P.border, cursor: ed.name.trim() ? "pointer" : "default", fontFamily: "inherit", padding: 0 }}>Save</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 28px" }}>
          {/* name + live preview */}
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 22 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: ed.color + "1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <HeadIcon size={26} strokeWidth={1.9} color={ed.color} />
            </div>
            <input value={ed.name} onChange={(e) => act.setEditSpaceField("name", e.target.value)} placeholder="Space name"
              style={{ flex: 1, minWidth: 0, boxSizing: "border-box", border: "1.5px solid " + P.border, borderRadius: 12, padding: "12px 14px", fontSize: 16, fontWeight: 700, color: P.ink, outline: "none", background: P.canvas, fontFamily: "inherit" }} />
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: P.warm, marginBottom: 10 }}>Color</div>
          <div style={{ display: "flex", gap: 11, marginBottom: 22, flexWrap: "wrap" }}>
            {SWATCHES.map((s) => {
              const on = ed.color.toLowerCase() === s.toLowerCase();
              return (
                <button key={s} onClick={() => act.setEditSpaceField("color", s)}
                  style={{ width: 32, height: 32, borderRadius: 99, background: s, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: on ? "0 0 0 2.5px #fff, 0 0 0 4.5px " + s : "none" }}>
                  {on && <I.Check size={15} color="#fff" />}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: P.warm, marginBottom: 10 }}>Icon</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, marginBottom: 24 }}>
            {ICON_CHOICES.map((ic) => {
              const Ic = I[ic] || I.Box;
              const on = ed.icon === ic;
              return (
                <button key={ic} onClick={() => act.setEditSpaceField("icon", ic)}
                  style={{ aspectRatio: "1", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: on ? ed.color : P.canvas, border: "1px solid " + (on ? ed.color : P.border), cursor: "pointer" }}>
                  <Ic size={17} strokeWidth={1.9} color={on ? "#fff" : P.inkMuted} />
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: P.warm }}>Areas · drag to reorder</span>
            <button onClick={act.addEditArea} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 800, color: P.accent, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}><I.Plus size={13} strokeWidth={2.5} color={P.accent} /> Add</button>
          </div>
          <div style={{ background: P.canvas, borderRadius: 14, border: "1px solid " + P.borderL, overflow: "hidden", marginBottom: 22 }}>
            {ed.areas.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", fontSize: 13, fontWeight: 600, color: P.warm }}>No areas yet — tap Add.</div>
            ) : (
              <ReorderList items={ed.areas} idOf={(a) => a.key} mode="handle" gap={0} onReorder={(arr) => act.reorderEditAreas(arr)} renderRow={areaRow} />
            )}
          </div>

          <button onClick={() => act.askDeleteSpace(ed.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 0", borderRadius: 12, border: "1.5px solid #F1C9C9", background: P.dangerSoft, color: P.danger, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            <I.Trash2 size={15} color={P.danger} /> Delete Space
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  StowScreens: Object.assign(window.StowScreens || {}, { SpacesManagedList, SpaceActionSheet, EditSpaceSheet }),
});
