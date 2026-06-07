/* Stow shared UI primitives. Each receives palette P via props. Exported to window. */
const { useState: useStateC } = React;

function cardStyle(P) {
  return { background: P.surface, borderRadius: P.radius + 8, border: "1px solid " + P.borderL, boxShadow: P.shadow };
}

function Label({ P, children, style }) {
  return <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: P.warm, marginBottom: 10, marginLeft: 2, ...style }}>{children}</div>;
}

function FieldLabel({ P, children }) {
  return <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: P.warm, marginBottom: 6 }}>{children}</div>;
}

function Input({ P, value, onChange, placeholder, type }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder} type={type || "text"}
      style={{ width: "100%", boxSizing: "border-box", borderRadius: P.radius + 2, padding: "12px 16px", fontSize: 15, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit" }} />
  );
}

function Button({ P, bg, color, onClick, children, style }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: "14px 0", borderRadius: P.radius + 6, fontWeight: 700, fontSize: 15, border: "none", background: bg, color: color, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, ...style }}>
      {children}
    </button>
  );
}

/* Bottom tab bar with center scan FAB */
function BottomNav({ P, tab, setTab, onScan, packedCount }) {
  const I = window.StowIcons;
  const tabs = [
    { key: "spaces", label: "Spaces", icon: I.Home },
    { key: "search", label: "Search", icon: I.Search },
    { key: "packing", label: "Packing", icon: I.Package, badge: packedCount },
    { key: "settings", label: "Settings", icon: I.Settings },
  ];
  const navBtn = (t) => {
    const active = tab === t.key;
    const Ic = t.icon;
    return (
      <button key={t.key} onClick={() => setTab(t.key)}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, border: "none", background: "none", cursor: "pointer", position: "relative", padding: 0 }}>
        <div style={{ position: "relative", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", height: 28 }}>
          {active && <div style={{ position: "absolute", inset: -6, borderRadius: 99, background: P.accentSoft }} />}
          <Ic size={22} strokeWidth={active ? 2.4 : 1.8} color={active ? P.accent : P.warm} style={{ position: "relative", zIndex: 1 }} />
          {t.badge ? (
            <div style={{ position: "absolute", top: -6, right: -10, background: P.accent, color: "#fff", fontSize: 9, fontWeight: 900, minWidth: 17, height: 17, padding: "0 4px", boxSizing: "border-box", borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid " + P.surface, zIndex: 2 }}>{t.badge}</div>
          ) : null}
        </div>
        <span style={{ fontSize: 10, fontWeight: active ? 800 : 600, color: active ? P.accent : P.warm, letterSpacing: 0.3 }}>{t.label}</span>
      </button>
    );
  };
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 30 }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", padding: "10px 14px 26px", background: P.surface + "F2", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid " + P.borderL }}>
        {navBtn(tabs[0])}
        {navBtn(tabs[1])}
        <div style={{ width: 70, flexShrink: 0, display: "flex", justifyContent: "center" }}>
          <button onClick={onScan}
            style={{ width: 56, height: 56, borderRadius: 20, marginTop: -34, border: "4px solid " + P.surface, background: P.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 8px 20px " + P.accent + "55" }}>
            <I.ScanLine size={24} strokeWidth={2.2} color="#fff" />
          </button>
        </div>
        {navBtn(tabs[2])}
        {navBtn(tabs[3])}
      </div>
    </div>
  );
}

/* Bottom sheet */
function Sheet({ P, open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "relative", background: P.surface, borderRadius: "28px 28px 0 0", boxShadow: "0 -10px 40px rgba(0,0,0,0.18)", maxHeight: "86%", display: "flex", flexDirection: "column", animation: "stowUp 0.3s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 5, borderRadius: 99, background: P.border }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 24px 12px" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: P.ink, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 99, background: P.canvas, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <window.StowIcons.X size={14} color={P.inkMuted} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 32px" }}>{children}</div>
      </div>
    </div>
  );
}

/* Confirmation dialog */
function Confirm({ P, open, title, body, confirmLabel, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "relative", background: P.surface, borderRadius: 24, padding: 24, width: "100%", maxWidth: 300, boxShadow: "0 20px 50px rgba(0,0,0,0.3)", animation: "stowPop 0.2s ease-out" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: P.ink }}>{title}</h3>
        <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.5, color: P.inkMuted }}>{body}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button P={P} bg={P.danger} color="#fff" onClick={onConfirm}>{confirmLabel}</Button>
          <Button P={P} bg={P.canvas} color={P.ink} onClick={onCancel} style={{ border: "1px solid " + P.border }}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

/* Transient toast */
function Toast({ P, msg }) {
  if (!msg) return null;
  return (
    <div style={{ position: "absolute", bottom: 110, left: "50%", transform: "translateX(-50%)", zIndex: 90, background: P.ink, color: P.surface, padding: "11px 20px", borderRadius: 99, fontSize: 14, fontWeight: 700, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "stowToast 0.3s ease-out", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
      <window.StowIcons.Check size={15} color={P.accent} /> {msg}
    </div>
  );
}

function RoleBadge({ P, role }) {
  const map = { OWNER: P.accent, ADMIN: P.success, MEMBER: P.warm };
  return <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: map[role], background: map[role] + "1A", padding: "3px 8px", borderRadius: 8 }}>{role}</span>;
}

Object.assign(window, {
  StowUI: { cardStyle, Label, FieldLabel, Input, Button, BottomNav, Sheet, Confirm, Toast, RoleBadge },
});
