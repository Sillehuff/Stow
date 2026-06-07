/* Shared mockup primitives for the Spaces-management option studies.
   Reuses Stow's light palette + iconography. Exported to window.MG. */

const P = {
  ink: "#1A1A2E", inkSoft: "#2D2D44", inkMuted: "#6B6B80", warm: "#9595A8",
  border: "#E8E8EE", borderL: "#F0F0F5", surface: "#FFFFFF", canvas: "#F7F7FA",
  accent: "#E8652B", success: "#2D9F6F", danger: "#E04545", dangerSoft: "#FFF0F0",
  radius: 12, shadow: "0 2px 10px rgba(0,0,0,0.05)", shadowSoft: "0 1px 3px rgba(0,0,0,0.04)",
};

const ROOMS = [
  { name: "Living Room", icon: "Home", color: "#E8652B", areas: 3, items: 3 },
  { name: "Kitchen", icon: "Coffee", color: "#2D9F6F", areas: 3, items: 3 },
  { name: "Office", icon: "Briefcase", color: "#5B6ABF", areas: 3, items: 3 },
  { name: "Garage", icon: "Box", color: "#C4883A", areas: 3, items: 1 },
];

const SWATCHES = ["#E8652B", "#2D9F6F", "#5B6ABF", "#C4883A", "#B0479A", "#2A6FDB", "#D6336C"];
const ICON_CHOICES = ["Home", "Coffee", "Briefcase", "Box", "Package", "Folder", "Bell", "Star"];

/* iOS-ish status bar */
function StatusBar({ dark }) {
  const col = dark ? "#fff" : P.ink;
  return (
    <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px 0 30px", flexShrink: 0 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: col, letterSpacing: 0.2 }}>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill="none"><rect x="0" y="6" width="3" height="5" rx="1" fill={col}/><rect x="4.5" y="4" width="3" height="7" rx="1" fill={col}/><rect x="9" y="2" width="3" height="9" rx="1" fill={col}/><rect x="13.5" y="0" width="3" height="11" rx="1" fill={col}/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><path d="M8 2.2c2.1 0 4 .8 5.4 2.2l1.1-1.1A9.3 9.3 0 0 0 8 .5 9.3 9.3 0 0 0 1.5 3.3l1.1 1.1A7.6 7.6 0 0 1 8 2.2Z" fill={col}/><path d="M8 5.5c1.2 0 2.3.5 3.1 1.3l1.1-1.1A6 6 0 0 0 8 3.9a6 6 0 0 0-4.2 1.8l1.1 1.1A4.4 4.4 0 0 1 8 5.5Z" fill={col}/><circle cx="8" cy="9" r="1.6" fill={col}/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={col} strokeOpacity="0.4"/><rect x="2" y="2" width="18" height="8" rx="1.5" fill={col}/><rect x="23" y="4" width="1.5" height="4" rx="0.75" fill={col} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

/* Screen shell sized for a canvas artboard */
function Screen({ children, bg }) {
  return (
    <div style={{ width: 360, height: 760, background: bg || P.canvas, position: "relative", overflow: "hidden", fontFamily: "var(--mg-body)", display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  );
}

/* Compact Spaces header + brand + value card */
function SpacesHeader({ title, action }) {
  const I = window.StowIcons;
  return (
    <div style={{ padding: "6px 22px 4px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: P.ink, letterSpacing: -0.5, fontFamily: "var(--mg-display)" }}>{title || <React.Fragment>Stow<span style={{ color: P.accent }}>.</span></React.Fragment>}</h1>
          <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 600, color: P.warm, whiteSpace: "nowrap" }}>10 items across 4 spaces</p>
        </div>
        {action || (
          <div style={{ width: 38, height: 38, borderRadius: 99, background: P.surface, border: "1px solid " + P.borderL, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: P.shadowSoft }}>
            <I.Bell size={17} color={P.inkMuted} />
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children, style }) {
  return <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: P.warm, margin: "0 0 10px 2px", ...style }}>{children}</div>;
}

function Card({ children, style }) {
  return <div style={{ background: P.surface, borderRadius: P.radius + 8, border: "1px solid " + P.borderL, boxShadow: P.shadow, overflow: "hidden", ...style }}>{children}</div>;
}

/* A space list row. `trailing` replaces the chevron; `leftAdorn` prepends (e.g. delete circle). */
function SpaceRow({ rm, last, trailing, leftAdorn, dim, faded }) {
  const I = window.StowIcons;
  const Ic = I[rm.icon] || I.Box;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: last ? "none" : "1px solid " + P.borderL, opacity: faded ? 0.45 : 1, background: dim ? P.canvas : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
        {leftAdorn}
        <div style={{ width: 42, height: 42, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", background: rm.color + "1A", color: rm.color, flexShrink: 0 }}>
          <Ic size={19} strokeWidth={1.9} color={rm.color} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rm.name}</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginTop: 1, whiteSpace: "nowrap" }}>{rm.areas} areas · {rm.items} item{rm.items !== 1 ? "s" : ""}</div>
        </div>
      </div>
      {trailing !== undefined ? trailing : <I.ChevronRight size={15} color={P.border} />}
    </div>
  );
}

/* Round icon button used for ··· affordances */
function GhostBtn({ children, danger }) {
  return (
    <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: danger ? P.dangerSoft : P.canvas, border: "1px solid " + (danger ? "#F3D0D0" : P.border), flexShrink: 0 }}>
      {children}
    </div>
  );
}

/* Bottom-sheet scrim + panel */
function SheetShell({ children, height, scrimOpacity }) {
  return (
    <React.Fragment>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0," + (scrimOpacity ?? 0.38) + ")", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height || "auto", background: P.surface, borderRadius: "26px 26px 0 0", boxShadow: "0 -10px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 11, paddingBottom: 2 }}>
          <div style={{ width: 36, height: 5, borderRadius: 99, background: P.border }} />
        </div>
        {children}
      </div>
    </React.Fragment>
  );
}

/* iOS-style action sheet (centered list of actions) */
function ActionSheet({ heading, sub, rows }) {
  return (
    <React.Fragment>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)" }} />
      <div style={{ position: "absolute", left: 10, right: 10, bottom: 12 }}>
        <div style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: 18, overflow: "hidden", boxShadow: "0 12px 36px rgba(0,0,0,0.18)" }}>
          {(heading || sub) && (
            <div style={{ textAlign: "center", padding: "16px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              {heading && <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>{heading}</div>}
              {sub && <div style={{ fontSize: 12, color: P.warm, marginTop: 2 }}>{sub}</div>}
            </div>
          )}
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "15px 18px", fontSize: 17, fontWeight: r.bold ? 700 : 500, color: r.danger ? P.danger : (r.tint ? P.accent : P.inkSoft), borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.07)" }}>
              {r.icon}{r.label}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(24px)", borderRadius: 18, textAlign: "center", padding: "16px 18px", fontSize: 17, fontWeight: 700, color: P.accent, boxShadow: "0 12px 36px rgba(0,0,0,0.14)" }}>Cancel</div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, {
  MG: { P, ROOMS, SWATCHES, ICON_CHOICES, StatusBar, Screen, SpacesHeader, Label, Card, SpaceRow, GhostBtn, SheetShell, ActionSheet },
});
