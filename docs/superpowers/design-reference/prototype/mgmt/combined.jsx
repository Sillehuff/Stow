/* Option D — the recommended synthesis: A's ··· entry + C's full editor,
   with B's drag-to-reorder folded into the list (no edit mode).
   Exported to window.MGCombined. */

const { P, ROOMS, SWATCHES, ICON_CHOICES, StatusBar, Screen, SpacesHeader, Label, Card, SpaceRow, SheetShell, ActionSheet } = window.MG;

function DValueCard() {
  return (
    <div style={{ margin: "12px 22px 16px", padding: 15, borderRadius: P.radius + 6, background: "linear-gradient(135deg, " + P.accent + ", color-mix(in srgb, " + P.accent + " 70%, #000))", color: "#fff", boxShadow: "0 8px 22px " + P.accent + "40", flexShrink: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", opacity: 0.85 }}>Estimated Value</div>
      <div style={{ fontSize: 27, fontWeight: 900, marginTop: 2, letterSpacing: -0.5 }}>$1,480</div>
    </div>
  );
}

const Grip = ({ c }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="6" r="1.4" fill={c || P.border}/><circle cx="15" cy="6" r="1.4" fill={c || P.border}/><circle cx="9" cy="12" r="1.4" fill={c || P.border}/><circle cx="15" cy="12" r="1.4" fill={c || P.border}/><circle cx="9" cy="18" r="1.4" fill={c || P.border}/><circle cx="15" cy="18" r="1.4" fill={c || P.border}/></svg>
);

/* ---- D1 · the list: one ··· affordance, hold-to-reorder hint ---- */
function D_List() {
  const I = window.StowIcons;
  return (
    <Screen>
      <StatusBar />
      <SpacesHeader />
      <DValueCard />
      <div style={{ padding: "0 22px" }}>
        <Label>Your Spaces</Label>
        <Card>
          {ROOMS.map((rm, i) => (
            <SpaceRow key={rm.name} rm={rm} last={i === ROOMS.length - 1}
              trailing={
                <div style={{ width: 30, height: 30, borderRadius: 99, background: i === 0 ? "#FDEDE5" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", border: i === 0 ? "1px solid " + P.accent + "55" : "1px solid transparent" }}>
                  <I.MoreHorizontal size={18} color={i === 0 ? P.accent : P.warm} />
                </div>
              } />
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 15, borderTop: "1px solid " + P.borderL, color: P.accent, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
            <I.Plus size={15} strokeWidth={2.5} color={P.accent} /> Add Space
          </div>
        </Card>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7, fontSize: 11.5, color: P.warm, fontWeight: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><I.MoreHorizontal size={14} color={P.warm} /> Tap ··· to rename, edit, or delete a space.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Grip c={P.warm} /> Touch &amp; hold a row to drag it into order.</div>
        </div>
      </div>
    </Screen>
  );
}

/* ---- D2 · quick-actions menu (A's entry, pointed at C's editor) ---- */
function D_Menu() {
  const I = window.StowIcons;
  return (
    <Screen>
      <StatusBar />
      <SpacesHeader />
      <DValueCard />
      <div style={{ padding: "0 22px" }}>
        <Label>Your Spaces</Label>
        <Card>
          {ROOMS.map((rm, i) => (
            <SpaceRow key={rm.name} rm={rm} last={i === ROOMS.length - 1} faded={i !== 0}
              trailing={<div style={{ width: 30, height: 30, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center" }}><I.MoreHorizontal size={18} color={P.warm} /></div>} />
          ))}
        </Card>
      </div>
      <ActionSheet heading="Living Room" sub="3 areas · 3 items"
        rows={[
          { icon: <I.Settings size={18} color={P.accent} />, label: "Edit space", tint: true, bold: true },
          { icon: <I.Edit size={18} color={P.accent} />, label: "Rename", tint: true },
          { icon: <I.Trash2 size={18} color={P.danger} />, label: "Delete space", danger: true },
        ]} />
    </Screen>
  );
}

/* ---- D3 · reorder happens in place — a lifted row, no edit mode ---- */
function D_Reorder() {
  const I = window.StowIcons;
  /* dragging "Garage" upward toward slot 2; order shown mid-gesture */
  const dragged = ROOMS[3];
  const rest = [ROOMS[0], ROOMS[1], ROOMS[2]]; // Living Room, Kitchen, Office
  const Row = ({ rm, last, dim, dropline }) => {
    const Ic = I[rm.icon] || I.Box;
    return (
      <React.Fragment>
        {dropline && <div style={{ height: 0, borderTop: "2px dashed " + P.accent, margin: "0 14px", opacity: 0.8 }} />}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: last ? "none" : "1px solid " + P.borderL, opacity: dim ? 0.5 : 1 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", background: rm.color + "1A", flexShrink: 0 }}>
            <Ic size={19} strokeWidth={1.9} color={rm.color} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: P.ink, whiteSpace: "nowrap" }}>{rm.name}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginTop: 1, whiteSpace: "nowrap" }}>{rm.areas} areas · {rm.items} item{rm.items !== 1 ? "s" : ""}</div>
          </div>
          <Grip />
        </div>
      </React.Fragment>
    );
  };
  const DraggedIc = I[dragged.icon] || I.Box;
  return (
    <Screen>
      <StatusBar />
      <SpacesHeader />
      <DValueCard />
      <div style={{ padding: "0 22px", position: "relative" }}>
        <Label>Your Spaces</Label>
        <Card>
          <Row rm={rest[0]} dim />
          <Row rm={rest[1]} dim dropline />
          <Row rm={rest[2]} dim last />
        </Card>

        {/* the lifted row, floating over the list */}
        <div style={{ position: "absolute", left: 22, right: 22, top: 92, display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: P.radius + 6, background: "#fff", boxShadow: "0 18px 40px rgba(0,0,0,0.22), 0 2px 0 " + P.accent + "22", border: "1px solid " + P.accent + "33", transform: "scale(1.035) rotate(-1.3deg)" }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", background: dragged.color + "1A", flexShrink: 0 }}>
            <DraggedIc size={19} strokeWidth={1.9} color={dragged.color} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: P.ink, whiteSpace: "nowrap" }}>{dragged.name}</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginTop: 1, whiteSpace: "nowrap" }}>{dragged.areas} areas · {dragged.items} item</div>
          </div>
          <Grip c={P.accent} />
        </div>

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: P.accent, fontWeight: 700 }}>
          <Grip c={P.accent} /> Drag “Garage” into place — release to drop. No edit mode.
        </div>
      </div>
    </Screen>
  );
}

/* ---- D4 · the full Edit Space sheet (C), area reorder lives here ---- */
function D_Editor() {
  const I = window.StowIcons;
  const areas = [
    { name: "Console Drawer", items: 2 }, { name: "TV Stand", items: 1 }, { name: "Bookshelf", items: 0 },
  ];
  return (
    <Screen bg="#EDEDF1">
      <StatusBar />
      <div style={{ flex: 1 }} />
      <SheetShell scrimOpacity={0.3} height={700}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 22px 14px", borderBottom: "1px solid " + P.borderL }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: P.warm }}>Cancel</span>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: P.ink, margin: 0, whiteSpace: "nowrap" }}>Edit Space</h2>
          <span style={{ fontSize: 15, fontWeight: 800, color: P.accent }}>Save</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden", padding: "18px 22px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "#E8652B1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <I.Home size={26} strokeWidth={1.9} color={P.accent} />
            </div>
            <div style={{ flex: 1, border: "1.5px solid " + P.border, borderRadius: 12, padding: "12px 14px", background: P.canvas, fontSize: 16, fontWeight: 700, color: P.ink }}>Living Room</div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: P.warm, marginBottom: 9 }}>Color</div>
          <div style={{ display: "flex", gap: 11, marginBottom: 20 }}>
            {SWATCHES.map((s, i) => (
              <div key={s} style={{ width: 30, height: 30, borderRadius: 99, background: s, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: i === 0 ? "0 0 0 2.5px #fff, 0 0 0 4.5px " + s : "none" }}>
                {i === 0 && <I.Check size={15} color="#fff" />}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: P.warm, marginBottom: 9 }}>Icon</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, marginBottom: 22 }}>
            {ICON_CHOICES.map((ic, i) => {
              const Ic = I[ic] || I.Box;
              const on = i === 0;
              return (
                <div key={ic} style={{ aspectRatio: "1", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: on ? P.accent : P.canvas, border: "1px solid " + (on ? P.accent : P.border) }}>
                  <Ic size={17} strokeWidth={1.9} color={on ? "#fff" : P.inkMuted} />
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: P.warm }}>Areas · drag to reorder</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 800, color: P.accent }}><I.Plus size={13} strokeWidth={2.5} color={P.accent} /> Add</span>
          </div>
          <div style={{ background: P.canvas, borderRadius: 14, border: "1px solid " + P.borderL, overflow: "hidden", marginBottom: 20 }}>
            {areas.map((a, i) => (
              <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i === areas.length - 1 ? "none" : "1px solid " + P.borderL }}>
                <Grip />
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: P.ink }}>{a.name}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, whiteSpace: "nowrap" }}>{a.items} item{a.items !== 1 ? "s" : ""}</span>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: P.dangerSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Trash2 size={13} color={P.danger} /></div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 0", borderRadius: 12, border: "1.5px solid #F1C9C9", background: P.dangerSoft, color: P.danger, fontSize: 14.5, fontWeight: 800 }}>
            <span style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}><I.Trash2 size={15} color={P.danger} /> Delete Space</span>
          </div>
        </div>
      </SheetShell>
    </Screen>
  );
}

Object.assign(window, {
  MGCombined: { D_List, D_Menu, D_Reorder, D_Editor },
});
