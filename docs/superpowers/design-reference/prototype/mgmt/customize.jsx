/* Option D — customizing a space: how far the COLOR palette and the ICON
   set should go in the Edit Space sheet. Exported to window.MGCust. */

const { P, StatusBar, Screen, SheetShell } = window.MG;
const CI = window.StowIcons;

/* curated default palette (what shows at rest) */
const CURATED = ["#E8652B", "#2D9F6F", "#5B6ABF", "#C4883A", "#B0479A", "#2A6FDB"];
/* the full preset palette revealed on "More / picker" */
const PALETTE = [
  "#E8652B", "#F2933C", "#E0B33A", "#C4883A", "#8C6A3E",
  "#2D9F6F", "#3FB68B", "#5BA84A", "#7FB23A", "#A8B14A",
  "#2A6FDB", "#3FA9C9", "#2BB5C0", "#5B6ABF", "#6C7FE0",
  "#8A5BC7", "#B0479A", "#D6336C", "#E0556E", "#7A7A8C",
];
/* icons offered in the gallery (existing + new) */
const GALLERY = [
  "Home", "Bed", "Sofa", "Briefcase", "Car", "Tv",
  "Coffee", "Utensils", "Wine", "Package", "Box", "Folder",
  "Inbox", "Tag", "Book", "Music", "Heart", "Gift",
  "Star", "Bell", "Leaf", "Sun", "Wrench", "Key",
  "Plug", "Shirt", "Camera", "Lock", "MapPin", "DollarSign",
];

/* ---------- small shared bits ---------- */
function SecLabel({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: P.warm }}>{children}</span>
      {right}
    </div>
  );
}

function NameChip({ icon = "Home", color = P.accent }) {
  const Ic = CI[icon] || CI.Box;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 22 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: color + "1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Ic size={26} strokeWidth={1.9} color={color} />
      </div>
      <div style={{ flex: 1, border: "1.5px solid " + P.border, borderRadius: 12, padding: "12px 14px", background: P.canvas, fontSize: 16, fontWeight: 700, color: P.ink }}>Living Room</div>
    </div>
  );
}

const Swatch = ({ c, on, size = 32 }) => (
  <div style={{ width: size, height: size, borderRadius: 99, background: c, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: on ? "0 0 0 2.5px #fff, 0 0 0 4.5px " + c : "inset 0 0 0 1px rgba(0,0,0,0.06)", flexShrink: 0 }}>
    {on && <CI.Check size={16} color="#fff" />}
  </div>
);

/* rainbow "custom / more" chip */
const CustomChip = ({ size = 32, label }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
    <div style={{ width: size, height: size, borderRadius: 99, background: "conic-gradient(from 90deg, #E8652B, #E0B33A, #2D9F6F, #2A6FDB, #8A5BC7, #D6336C, #E8652B)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: size - 11, height: size - 11, borderRadius: 99, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CI.Plus size={14} strokeWidth={2.6} color={P.ink} />
      </div>
    </div>
    {label && <span style={{ fontSize: 9.5, fontWeight: 700, color: P.warm }}>{label}</span>}
  </div>
);

/* compact icon row used when the section is not the focus */
function IconCompact() {
  const set = ["Home", "Coffee", "Briefcase", "Box", "Package", "Folder", "Bell", "Star"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
      {set.map((ic, i) => {
        const Ic = CI[ic] || CI.Box;
        const on = i === 0;
        return (
          <div key={ic} style={{ aspectRatio: "1", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: on ? P.accent : P.canvas, border: "1px solid " + (on ? P.accent : P.border) }}>
            <Ic size={16} strokeWidth={1.9} color={on ? "#fff" : P.inkMuted} />
          </div>
        );
      })}
    </div>
  );
}

/* the bottom-sheet editor frame */
function EditorShell({ children, height }) {
  return (
    <Screen bg="#EDEDF1">
      <StatusBar />
      <div style={{ flex: 1 }} />
      <SheetShell scrimOpacity={0.3} height={height || 700}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 22px 14px", borderBottom: "1px solid " + P.borderL }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: P.warm }}>Cancel</span>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: P.ink, margin: 0, whiteSpace: "nowrap" }}>Edit Space</h2>
          <span style={{ fontSize: 15, fontWeight: 800, color: P.accent }}>Save</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden", padding: "18px 22px 0", position: "relative" }}>{children}</div>
      </SheetShell>
    </Screen>
  );
}

/* bottom scroll-fade to signal there's more below (areas, delete) */
const ScrollFade = () => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 40, background: "linear-gradient(transparent, #fff)", pointerEvents: "none" }} />
);

/* =================================================================
   COLORS
   ================================================================= */

/* C1 — resting: curated swatches + one rainbow "custom" chip */
function C_Resting() {
  return (
    <EditorShell>
      <NameChip />
      <SecLabel>Color</SecLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        {CURATED.map((c, i) => <Swatch key={c} c={c} on={i === 0} />)}
        <div style={{ width: 1, height: 24, background: P.border, margin: "0 2px" }} />
        <CustomChip />
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginBottom: 22, display: "flex", alignItems: "center", gap: 6 }}>
        Six favourites stay one tap away — the rainbow chip opens every other colour.
      </div>
      <SecLabel>Icon</SecLabel>
      <IconCompact />
      <ScrollFade />
    </EditorShell>
  );
}

/* C2 — inline expand: "More" reveals the full preset grid in place */
function C_Expand() {
  return (
    <EditorShell height={720}>
      <NameChip />
      <SecLabel right={<span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 800, color: P.accent }}>Less <CI.ChevronDown size={13} color={P.accent} style={{ transform: "rotate(180deg)" }} /></span>}>Color</SecLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, justifyItems: "center", marginBottom: 12 }}>
        {PALETTE.map((c, i) => <Swatch key={c} c={c} on={i === 0} />)}
        <CustomChip />
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginBottom: 18 }}>
        Tapping “More” drops the full preset set in place — no extra screen to back out of.
      </div>
      <SecLabel>Icon</SecLabel>
      <IconCompact />
      <ScrollFade />
    </EditorShell>
  );
}

/* C3 — dedicated picker sheet: presets + true custom spectrum + hex */
function C_Picker() {
  const recents = ["#1F8A5B", "#C0476B", "#2A6FDB"];
  return (
    <Screen bg="#EDEDF1">
      <StatusBar />
      <div style={{ flex: 1 }} />
      <SheetShell scrimOpacity={0.34} height={560}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 22px 14px", borderBottom: "1px solid " + P.borderL }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: P.warm }}>Cancel</span>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: P.ink, margin: 0 }}>Choose Color</h2>
          <span style={{ fontSize: 15, fontWeight: 800, color: P.accent }}>Done</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden", padding: "18px 22px 0" }}>
          <SecLabel>Presets</SecLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, justifyItems: "center", marginBottom: 22 }}>
            {PALETTE.map((c, i) => <Swatch key={c} c={c} on={i === 0} size={30} />)}
          </div>

          <SecLabel>Custom</SecLabel>
          {/* saturation / value field */}
          <div style={{ position: "relative", height: 110, borderRadius: 14, marginBottom: 12, background: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), #E8652B", border: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ position: "absolute", left: "62%", top: "30%", width: 18, height: 18, borderRadius: 99, border: "2.5px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.3)", transform: "translate(-50%,-50%)" }} />
          </div>
          {/* hue bar */}
          <div style={{ position: "relative", height: 14, borderRadius: 99, marginBottom: 16, background: "linear-gradient(to right, #ff0000, #ffb300, #cfff00, #00ff66, #00ffe1, #008bff, #6a00ff, #ff00c8, #ff0000)" }}>
            <div style={{ position: "absolute", left: "8%", top: "50%", width: 20, height: 20, borderRadius: 99, background: "#E8652B", border: "3px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.3)", transform: "translate(-50%,-50%)" }} />
          </div>
          {/* hex + recents */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, border: "1.5px solid " + P.border, borderRadius: 11, padding: "9px 12px", background: P.canvas }}>
              <div style={{ width: 22, height: 22, borderRadius: 7, background: "#E8652B", flexShrink: 0 }} />
              <span style={{ fontSize: 14.5, fontWeight: 700, color: P.ink, letterSpacing: 0.5 }}>#E8652B</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {recents.map((c) => <div key={c} style={{ width: 26, height: 26, borderRadius: 8, background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }} />)}
            </div>
          </div>
          <div style={{ marginTop: 13, fontSize: 11.5, fontWeight: 600, color: P.warm }}>The chip opens this — presets up top, full spectrum + hex for anything else, plus your recents.</div>
        </div>
      </SheetShell>
    </Screen>
  );
}

/* =================================================================
   ICONS
   ================================================================= */

/* I1 — resting: a couple of rows + a "View all" tile that shows the count */
function I_Resting() {
  const shown = ["Home", "Bed", "Sofa", "Coffee", "Briefcase", "Car", "Box", "Package", "Folder", "Star", "Leaf", "Heart"];
  return (
    <EditorShell height={710}>
      <NameChip />
      <SecLabel>Color</SecLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        {CURATED.map((c, i) => <Swatch key={c} c={c} on={i === 0} size={28} />)}
        <div style={{ width: 1, height: 22, background: P.border, margin: "0 2px" }} />
        <CustomChip size={28} />
      </div>
      <SecLabel>Icon</SecLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 9 }}>
        {shown.map((ic, i) => {
          const Ic = CI[ic] || CI.Box;
          const on = i === 0;
          return (
            <div key={ic} style={{ aspectRatio: "1", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: on ? P.accent : P.canvas, border: "1px solid " + (on ? P.accent : P.border) }}>
              <Ic size={18} strokeWidth={1.9} color={on ? "#fff" : P.inkMuted} />
            </div>
          );
        })}
        {/* view all tile */}
        <div style={{ aspectRatio: "1", borderRadius: 11, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "#FDEDE5", border: "1px solid " + P.accent + "44" }}>
          <CI.Grid size={16} color={P.accent} />
          <span style={{ fontSize: 8.5, fontWeight: 800, color: P.accent }}>All 30</span>
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600, color: P.warm }}>
        Twelve common icons stay visible; the “All 30” tile opens the full library.
      </div>
      <ScrollFade />
    </EditorShell>
  );
}

/* I2 — the full icon library: search + categories + grid */
function I_Library() {
  const cats = ["All", "Rooms", "Storage", "Kitchen", "Outdoor"];
  return (
    <Screen bg="#EDEDF1">
      <StatusBar />
      <div style={{ flex: 1 }} />
      <SheetShell scrimOpacity={0.34} height={640}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 22px 14px", borderBottom: "1px solid " + P.borderL }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: P.warm }}>Cancel</span>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: P.ink, margin: 0 }}>Choose Icon</h2>
          <span style={{ fontSize: 15, fontWeight: 800, color: P.accent }}>Done</span>
        </div>
        <div style={{ padding: "14px 22px 0" }}>
          {/* search */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, background: P.canvas, border: "1px solid " + P.border, borderRadius: 12, padding: "10px 13px", marginBottom: 12 }}>
            <CI.Search size={16} color={P.warm} />
            <span style={{ fontSize: 14.5, color: P.warm, fontWeight: 500 }}>Search icons…</span>
          </div>
          {/* category chips */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, overflow: "hidden" }}>
            {cats.map((c, i) => (
              <div key={c} style={{ padding: "7px 14px", borderRadius: 99, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", background: i === 0 ? P.accent : P.canvas, color: i === 0 ? "#fff" : P.inkMuted, border: "1px solid " + (i === 0 ? P.accent : P.border) }}>{c}</div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflow: "hidden", padding: "0 22px", position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
            {GALLERY.map((ic, i) => {
              const Ic = CI[ic] || CI.Box;
              const on = i === 0;
              return (
                <div key={ic} style={{ aspectRatio: "1", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: on ? P.accent : "#fff", border: "1px solid " + (on ? P.accent : P.border), boxShadow: on ? "0 4px 12px " + P.accent + "44" : "none" }}>
                  <Ic size={19} strokeWidth={1.9} color={on ? "#fff" : P.inkSoft} />
                </div>
              );
            })}
          </div>
          <ScrollFade />
        </div>
      </SheetShell>
    </Screen>
  );
}

Object.assign(window, {
  MGCust: { C_Resting, C_Expand, C_Picker, I_Resting, I_Library },
});
