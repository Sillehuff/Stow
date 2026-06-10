/* Shared primitives for the Stow UX-enhancement studies.
   Reuses Stow's light palette (window.MG.P) + iconography. Exported to window.EX. */

const { P, StatusBar, Screen } = window.MG;

/* Photos already proven to load in the existing Stow prototype. */
const IMG = {
  headphones: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80",
  camera: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80",
  keyboard: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=400&q=80",
  mic: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&q=80",
  watch: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80",
  earbuds: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
  coffee: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=400&q=80",
  scissors: "https://images.unsplash.com/photo-1574231164645-d6f0e8553590?w=400&q=80",
  feed: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=900&q=80",
};

/* Lifecycle status vocabulary — a first-class, glanceable property. */
const STATUS = {
  home:   { label: "At home",   color: "#6B6B80", soft: "#F0F0F5", icon: "Home" },
  packed: { label: "Packed",    color: "#5B6ABF", soft: "#ECEEF8", icon: "Package" },
  lent:   { label: "Lent out",  color: "#E8652B", soft: "#FDEDE5", icon: "Users" },
  repair: { label: "In repair", color: "#C4883A", soft: "#F8F0E2", icon: "Wrench" },
  lost:   { label: "Missing",   color: "#E04545", soft: "#FFF0F0", icon: "Search" },
};

const PEOPLE = {
  marcus: { name: "Marcus Lee", color: "#5B6ABF" },
  sam:    { name: "Sam Rivera", color: "#2D9F6F" },
  jess:   { name: "Jess Park",  color: "#C4883A" },
  you:    { name: "You",        color: "#E8652B" },
};

/* Round initials avatar */
function Avatar({ who, size = 30, ring }) {
  const p = PEOPLE[who] || { name: who, color: P.warm };
  const initials = p.name.split(" ").map((x) => x[0]).join("").slice(0, 2);
  return (
    <div style={{ width: size, height: size, borderRadius: 99, background: p.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 800, flexShrink: 0, boxShadow: ring ? "0 0 0 2.5px " + P.surface : "none", letterSpacing: 0.2 }}>
      {initials}
    </div>
  );
}

/* Status pill — colored dot + label, optionally with an icon */
function StatusPill({ status, withIcon, small }) {
  const I = window.StowIcons;
  const s = STATUS[status];
  const Ic = withIcon ? I[s.icon] : null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: small ? 5 : 6, padding: small ? "4px 9px" : "5px 11px", borderRadius: 99, background: s.soft, color: s.color, fontSize: small ? 11 : 12, fontWeight: 800, letterSpacing: 0.2, whiteSpace: "nowrap" }}>
      {Ic ? <Ic size={small ? 11 : 12} color={s.color} strokeWidth={2.2} /> : <span style={{ width: 6, height: 6, borderRadius: 99, background: s.color }} />}
      {s.label}
    </span>
  );
}

/* Wayfinding breadcrumb: Space › Area, with the space's color */
function Bread({ room, area, color, big }) {
  const I = window.StowIcons;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: big ? 9 : 6, minWidth: 0 }}>
      <span style={{ width: big ? 11 : 9, height: big ? 11 : 9, borderRadius: 99, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: big ? 19 : 14, fontWeight: 800, color: P.ink, letterSpacing: -0.2, whiteSpace: "nowrap", flexShrink: 0 }}>{room}</span>
      <I.ChevronRight size={big ? 16 : 13} color={P.warm} strokeWidth={2.4} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: big ? 19 : 14, fontWeight: 700, color: P.inkSoft, whiteSpace: "nowrap", flexShrink: 0 }}>{area}</span>
    </div>
  );
}

/* Compact bottom tab bar with the center scan FAB (matches the real app) */
function BottomNav({ active = "spaces", accentScan }) {
  const I = window.StowIcons;
  const tabs = [
    { key: "spaces", label: "Spaces", icon: I.Home },
    { key: "search", label: "Search", icon: I.Search },
    { key: "packing", label: "Packing", icon: I.Package },
    { key: "settings", label: "Settings", icon: I.Settings },
  ];
  const btn = (t) => {
    const on = active === t.key;
    const Ic = t.icon;
    return (
      <div key={t.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
        <div style={{ position: "relative", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", height: 26 }}>
          {on && <div style={{ position: "absolute", inset: -6, borderRadius: 99, background: P.accent + "16" }} />}
          <Ic size={21} strokeWidth={on ? 2.4 : 1.8} color={on ? P.accent : P.warm} style={{ position: "relative" }} />
        </div>
        <span style={{ fontSize: 9.5, fontWeight: on ? 800 : 600, color: on ? P.accent : P.warm }}>{t.label}</span>
      </div>
    );
  };
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center", padding: "9px 12px 22px", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid " + P.borderL, zIndex: 40 }}>
      {btn(tabs[0])}
      {btn(tabs[1])}
      <div style={{ width: 64, flexShrink: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 18, marginTop: -30, border: "4px solid " + P.surface, background: P.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px " + P.accent + "55" }}>
          <I.ScanLine size={22} strokeWidth={2.2} color="#fff" />
        </div>
      </div>
      {btn(tabs[2])}
      {btn(tabs[3])}
    </div>
  );
}

/* Brand header used on home-context frames */
function Brand({ sub }) {
  const I = window.StowIcons;
  return (
    <div style={{ padding: "6px 22px 8px", flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 900, color: P.ink, letterSpacing: -0.5, fontFamily: "var(--mg-display)" }}>Stow<span style={{ color: P.accent }}>.</span></h1>
        <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 600, color: P.warm }}>{sub || "10 items · 4 spaces"}</p>
      </div>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: P.surface, border: "1px solid " + P.borderL, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: P.shadowSoft }}>
        <I.Bell size={17} color={P.inkMuted} />
      </div>
    </div>
  );
}

/* Section eyebrow label, optionally with a trailing count chip */
function Eyebrow({ children, count, countColor }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 11px 2px" }}>
      <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: P.warm, whiteSpace: "nowrap" }}>{children}</span>
      {count != null && (
        <span style={{ fontSize: 10.5, fontWeight: 800, color: countColor || P.warm, background: (countColor || P.warm) + "1A", borderRadius: 99, padding: "2px 8px" }}>{count}</span>
      )}
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: P.surface, borderRadius: P.radius + 8, border: "1px solid " + P.borderL, boxShadow: P.shadow, overflow: "hidden", ...style }}>{children}</div>;
}

Object.assign(window, {
  EX: { IMG, STATUS, PEOPLE, Avatar, StatusPill, Bread, BottomNav, Brand, Eyebrow, Card },
});
