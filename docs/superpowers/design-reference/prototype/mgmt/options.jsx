/* Spaces-management design options. Each component renders one canvas frame.
   Exported to window.MGOptions. */

const { P, ROOMS, SWATCHES, ICON_CHOICES, StatusBar, Screen, SpacesHeader, Label, Card, SpaceRow, GhostBtn, SheetShell, ActionSheet } = window.MG;

/* shared value card for context */
function ValueCard() {
  return (
    <div style={{ margin: "12px 22px 16px", padding: 15, borderRadius: P.radius + 6, background: "linear-gradient(135deg, " + P.accent + ", color-mix(in srgb, " + P.accent + " 70%, #000))", color: "#fff", boxShadow: "0 8px 22px " + P.accent + "40", flexShrink: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", opacity: 0.85 }}>Estimated Value</div>
      <div style={{ fontSize: 27, fontWeight: 900, marginTop: 2, letterSpacing: -0.5 }}>$1,480</div>
    </div>
  );
}

/* ============================ OPTION A ============================ */
/* A1 — list with a ··· affordance per row */
function A_Trigger() {
  const I = window.StowIcons;
  return (
    <Screen>
      <StatusBar />
      <SpacesHeader />
      <ValueCard />
      <div style={{ padding: "0 22px" }}>
        <Label>Your Spaces</Label>
        <Card>
          {ROOMS.map((rm, i) => (
            <SpaceRow key={rm.name} rm={rm} last={i === ROOMS.length - 1}
              trailing={
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 99, background: i === 0 ? P.accentSoft || "#FDEDE5" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", border: i === 0 ? "1px solid " + P.accent + "55" : "1px solid transparent" }}>
                    <I.MoreHorizontal size={18} color={i === 0 ? P.accent : P.warm} />
                  </div>
                </div>
              } />
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 15, borderTop: "1px solid " + P.borderL, color: P.accent, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
            <I.Plus size={15} strokeWidth={2.5} color={P.accent} /> Add Space
          </div>
        </Card>
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: P.warm, fontWeight: 600 }}>
          <I.MoreHorizontal size={14} color={P.warm} /> Tap ··· on any space — or long-press the row — to manage it.
        </div>
      </div>
    </Screen>
  );
}

/* A2 — action sheet open for one space */
function A_Menu() {
  const I = window.StowIcons;
  return (
    <Screen>
      <StatusBar />
      <SpacesHeader />
      <ValueCard />
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
          { icon: <I.Edit size={18} color={P.accent} />, label: "Rename", tint: true },
          { icon: <I.Star size={18} color={P.accent} />, label: "Change icon & color", tint: true },
          { icon: <I.Box size={18} color={P.accent} />, label: "Manage areas", tint: true },
          { icon: <I.Trash2 size={18} color={P.danger} />, label: "Delete space", danger: true },
        ]} />
    </Screen>
  );
}

/* A3 — areas inside a room get the same ··· treatment */
function A_Areas() {
  const I = window.StowIcons;
  const areas = [
    { name: "Console Drawer", items: 2 }, { name: "TV Stand", items: 1 }, { name: "Bookshelf", items: 0 },
  ];
  return (
    <Screen>
      <StatusBar />
      <div style={{ padding: "8px 14px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: P.surface, borderBottom: "1px solid " + P.borderL, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, color: P.accent, fontWeight: 700, fontSize: 15 }}>
          <I.ChevronLeft size={20} strokeWidth={2.5} color={P.accent} /> Spaces
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: P.ink, whiteSpace: "nowrap" }}>Living Room</span>
        <div style={{ display: "flex", gap: 2 }}>
          <div style={{ padding: 7 }}><I.Camera size={17} color={P.inkMuted} /></div>
          <div style={{ padding: 7 }}><I.QrCode size={17} color={P.inkMuted} /></div>
        </div>
      </div>
      <div style={{ padding: "16px 16px 0" }}>
        <Label>3 Areas</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {areas.map((a, i) => (
            <div key={a.name} style={{ background: P.surface, borderRadius: P.radius + 4, border: "1px solid " + P.borderL, boxShadow: P.shadow, padding: 14, minHeight: 100, position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: "#E8652B16", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <I.Box size={17} color={P.accent} strokeWidth={1.9} />
                </div>
                <div style={{ width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: i === 0 ? "#FDEDE5" : "transparent", border: i === 0 ? "1px solid " + P.accent + "55" : "none" }}>
                  <I.MoreHorizontal size={15} color={i === 0 ? P.accent : P.warm} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, lineHeight: 1.3 }}>{a.name}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginTop: 2 }}>{a.items} item{a.items !== 1 ? "s" : ""}</div>
              </div>
            </div>
          ))}
          <div style={{ borderRadius: P.radius + 4, padding: 14, minHeight: 100, border: "2px dashed " + P.border, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <I.Plus size={19} strokeWidth={2.5} color={P.accent} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: P.accent, whiteSpace: "nowrap" }}>Add Area</span>
          </div>
        </div>
      </div>
      <ActionSheet heading="Console Drawer" sub="2 items"
        rows={[
          { icon: <I.Edit size={18} color={P.accent} />, label: "Rename area", tint: true },
          { icon: <I.ArrowRight size={18} color={P.accent} />, label: "Move items & delete", tint: true },
          { icon: <I.Trash2 size={18} color={P.danger} />, label: "Delete area", danger: true },
        ]} />
    </Screen>
  );
}

/* ============================ OPTION B ============================ */
/* B1 — Edit mode: delete circles + drag grips + Done */
function B_EditMode() {
  const I = window.StowIcons;
  const Grip = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="6" r="1.4" fill={P.border}/><circle cx="15" cy="6" r="1.4" fill={P.border}/><circle cx="9" cy="12" r="1.4" fill={P.border}/><circle cx="15" cy="12" r="1.4" fill={P.border}/><circle cx="9" cy="18" r="1.4" fill={P.border}/><circle cx="15" cy="18" r="1.4" fill={P.border}/></svg>
  );
  const MinusCircle = () => (
    <div style={{ width: 23, height: 23, borderRadius: 99, background: P.danger, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: 11, height: 2.4, borderRadius: 2, background: "#fff" }} />
    </div>
  );
  return (
    <Screen>
      <StatusBar />
      <div style={{ padding: "6px 22px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: P.ink, letterSpacing: -0.5, fontFamily: "var(--mg-display)" }}>Spaces</h1>
        <div style={{ padding: "7px 16px", borderRadius: 99, background: P.accent, color: "#fff", fontSize: 14, fontWeight: 800 }}>Done</div>
      </div>
      <p style={{ margin: "3px 22px 0", fontSize: 12, fontWeight: 600, color: P.warm, flexShrink: 0 }}>Reorder, rename, or remove your spaces</p>
      <div style={{ padding: "18px 22px 0" }}>
        <Card>
          {ROOMS.map((rm, i) => (
            <SpaceRow key={rm.name} rm={rm} last={i === ROOMS.length - 1}
              leftAdorn={<MinusCircle />}
              trailing={<Grip />} />
          ))}
        </Card>
        <div style={{ marginTop: 12, padding: "13px 16px", borderRadius: P.radius + 8, border: "2px dashed " + P.border, display: "flex", alignItems: "center", gap: 8, color: P.accent, fontWeight: 700, fontSize: 14, background: P.surface }}>
          <I.Plus size={16} strokeWidth={2.5} color={P.accent} /> <span style={{ whiteSpace: "nowrap" }}>New Space</span>
        </div>
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: P.warm, fontWeight: 600 }}>
          <Grip /> Drag to reorder · tap a name to rename · — to remove.
        </div>
      </div>
    </Screen>
  );
}

/* B2 — inline rename in edit mode (keyboard up) */
function B_Rename() {
  const I = window.StowIcons;
  const MinusCircle = () => (
    <div style={{ width: 23, height: 23, borderRadius: 99, background: P.danger, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: 11, height: 2.4, borderRadius: 2, background: "#fff" }} />
    </div>
  );
  const Grip = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="6" r="1.4" fill={P.border}/><circle cx="15" cy="6" r="1.4" fill={P.border}/><circle cx="9" cy="12" r="1.4" fill={P.border}/><circle cx="15" cy="12" r="1.4" fill={P.border}/><circle cx="9" cy="18" r="1.4" fill={P.border}/><circle cx="15" cy="18" r="1.4" fill={P.border}/></svg>
  );
  const editingRow = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: "1px solid " + P.borderL, background: "#FFF" }}>
      <MinusCircle />
      <div style={{ width: 42, height: 42, borderRadius: 13, background: "#E8652B1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <I.Home size={19} strokeWidth={1.9} color={P.accent} />
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: "1.5px solid " + P.accent, borderRadius: 10, padding: "8px 10px", background: P.canvas }}>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: P.ink, whiteSpace: "nowrap" }}>Living Room</span>
        <span style={{ width: 1.5, height: 17, background: P.accent, animation: "mgBlink 1s step-end infinite" }} />
      </div>
      <Grip />
    </div>
  );
  return (
    <Screen>
      <StatusBar />
      <div style={{ padding: "6px 22px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: P.ink, letterSpacing: -0.5, fontFamily: "var(--mg-display)" }}>Spaces</h1>
        <div style={{ padding: "7px 16px", borderRadius: 99, background: P.accent, color: "#fff", fontSize: 14, fontWeight: 800 }}>Done</div>
      </div>
      <div style={{ padding: "18px 22px 0" }}>
        <Card>
          {editingRow}
          {ROOMS.slice(1).map((rm, i) => (
            <SpaceRow key={rm.name} rm={rm} last={i === ROOMS.length - 2} faded
              leftAdorn={<MinusCircle />} trailing={<Grip />} />
          ))}
        </Card>
      </div>
      {/* faux keyboard */}
      <div style={{ marginTop: "auto", background: "#D1D4DB", padding: "8px 5px 26px", flexShrink: 0 }}>
        {[["Q","W","E","R","T","Y","U","I","O","P"],["A","S","D","F","G","H","J","K","L"],["Z","X","C","V","B","N","M"]].map((row, ri) => (
          <div key={ri} style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 7, padding: ri === 1 ? "0 18px" : 0 }}>
            {ri === 2 && <div style={{ flex: 1.4, height: 38, borderRadius: 6, background: "#ADB3BD", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#33373E" strokeWidth="2"><path d="M12 5l-7 7 7 7M19 12H6"/></svg></div>}
            {row.map((k) => (
              <div key={k} style={{ flex: 1, height: 38, borderRadius: 6, background: "#fff", boxShadow: "0 1px 0 rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 500, color: P.ink }}>{k}</div>
            ))}
            {ri === 2 && <div style={{ flex: 1.4, height: 38, borderRadius: 6, background: "#ADB3BD" }} />}
          </div>
        ))}
      </div>
    </Screen>
  );
}

/* ============================ OPTION C ============================ */
/* C1 — entry: room header carries an Edit affordance */
function C_Entry() {
  const I = window.StowIcons;
  const areas = ["Console Drawer", "TV Stand", "Bookshelf"];
  return (
    <Screen>
      <StatusBar />
      <div style={{ padding: "8px 14px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: P.surface, borderBottom: "1px solid " + P.borderL, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, color: P.accent, fontWeight: 700, fontSize: 15 }}>
          <I.ChevronLeft size={20} strokeWidth={2.5} color={P.accent} /> Spaces
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: P.ink, whiteSpace: "nowrap" }}>Living Room</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px 6px 9px", borderRadius: 99, background: "#FDEDE5", border: "1px solid " + P.accent + "55" }}>
          <I.Edit size={14} color={P.accent} /><span style={{ fontSize: 13, fontWeight: 800, color: P.accent }}>Edit</span>
        </div>
      </div>
      <div style={{ padding: "16px 16px 0" }}>
        <Label>3 Areas</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {areas.map((a) => (
            <div key={a} style={{ background: P.surface, borderRadius: P.radius + 4, border: "1px solid " + P.borderL, boxShadow: P.shadow, padding: 14, minHeight: 96, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: "#E8652B16", display: "flex", alignItems: "center", justifyContent: "center" }}><I.Box size={17} color={P.accent} strokeWidth={1.9} /></div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{a}</div>
            </div>
          ))}
          <div style={{ borderRadius: P.radius + 4, padding: 14, minHeight: 96, border: "2px dashed " + P.border, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <I.Plus size={19} strokeWidth={2.5} color={P.accent} /><span style={{ fontSize: 12.5, fontWeight: 700, color: P.accent, whiteSpace: "nowrap" }}>Add Area</span>
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: P.warm, fontWeight: 600 }}>
          <I.Edit size={14} color={P.warm} /> One Edit button opens a full editor for name, color, icon &amp; areas.
        </div>
      </div>
    </Screen>
  );
}

/* C2 — the full Edit Space sheet (hero) */
function C_Editor() {
  const I = window.StowIcons;
  const areas = [
    { name: "Console Drawer", items: 2 }, { name: "TV Stand", items: 1 }, { name: "Bookshelf", items: 0 },
  ];
  return (
    <Screen bg="#EDEDF1">
      <StatusBar />
      <div style={{ flex: 1 }} />
      <SheetShell scrimOpacity={0.3} height={690}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 22px 14px", borderBottom: "1px solid " + P.borderL }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: P.warm }}>Cancel</span>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: P.ink, margin: 0, whiteSpace: "nowrap" }}>Edit Space</h2>
          <span style={{ fontSize: 15, fontWeight: 800, color: P.accent }}>Save</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden", padding: "18px 22px 0" }}>
          {/* preview chip */}
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
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: P.warm }}>Areas</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 800, color: P.accent }}><I.Plus size={13} strokeWidth={2.5} color={P.accent} /> Add</span>
          </div>
          <div style={{ background: P.canvas, borderRadius: 14, border: "1px solid " + P.borderL, overflow: "hidden", marginBottom: 20 }}>
            {areas.map((a, i) => (
              <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i === areas.length - 1 ? "none" : "1px solid " + P.borderL }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="6" r="1.4" fill={P.border}/><circle cx="15" cy="6" r="1.4" fill={P.border}/><circle cx="9" cy="12" r="1.4" fill={P.border}/><circle cx="15" cy="12" r="1.4" fill={P.border}/><circle cx="9" cy="18" r="1.4" fill={P.border}/><circle cx="15" cy="18" r="1.4" fill={P.border}/></svg>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: P.ink }}>{a.name}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, whiteSpace: "nowrap" }}>{a.items} item{a.items !== 1 ? "s" : ""}</span>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: P.dangerSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Trash2 size={13} color={P.danger} /></div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 0", borderRadius: 12, border: "1.5px solid " + "#F1C9C9", background: P.dangerSoft, color: P.danger, fontSize: 14.5, fontWeight: 800 }}>
            <span style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}><I.Trash2 size={15} color={P.danger} /> Delete Space</span>
          </div>
        </div>
      </SheetShell>
    </Screen>
  );
}

Object.assign(window, {
  MGOptions: { A_Trigger, A_Menu, A_Areas, B_EditMode, B_Rename, C_Entry, C_Editor },
});
