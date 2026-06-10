/* Enhancement 1 — "Where is it?" : retrieval rendered as a confident ANSWER,
   not a list to scan. Frames exported to window.EX_FIND. */

const { P, StatusBar, Screen } = window.MG;
const { IMG, Avatar, Bread, BottomNav, Brand, Eyebrow, Card } = window.EX;

const LR = "#E8652B"; // Living Room color

/* Search field, prefilled, with the active accent ring */
function SearchField({ value, active }) {
  const I = window.StowIcons;
  return (
    <div style={{ position: "relative" }}>
      <I.Search size={18} color={active ? P.accent : P.warm} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
      <div style={{ width: "100%", boxSizing: "border-box", borderRadius: P.radius + 6, padding: "14px 44px 14px 46px", fontSize: 16, fontWeight: 600, border: "1.5px solid " + (active ? P.accent : P.border), background: P.canvas, color: value ? P.ink : P.warm, boxShadow: active ? "0 0 0 4px " + P.accent + "22" : P.shadowSoft }}>
        {value || "Find anything…"}<span style={{ display: active ? "inline-block" : "none", width: 2, height: 17, background: P.accent, marginLeft: 1, verticalAlign: "-3px", animation: "mgBlink 1s step-end infinite" }} />
      </div>
      {value && (
        <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: 99, background: P.border, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <I.X size={13} color={P.inkMuted} />
        </div>
      )}
    </div>
  );
}

/* ============================ F1 — the Answer card ============================ */
function F1_Answer() {
  const I = window.StowIcons;
  return (
    <Screen>
      <StatusBar />
      <div style={{ padding: "10px 22px 14px", borderBottom: "1px solid " + P.borderL, background: P.surface }}>
        <SearchField value="headphones" active />
      </div>

      <div style={{ flex: 1, overflow: "hidden", padding: "18px 22px" }}>
        {/* the answer */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, marginLeft: 2 }}>
          <I.Check size={14} color={P.success} strokeWidth={3} />
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4, color: P.success, whiteSpace: "nowrap" }}>Found it</span>
        </div>

        <Card style={{ borderRadius: 22, border: "1.5px solid " + LR + "33", boxShadow: "0 14px 34px rgba(232,101,43,0.13)" }}>
          {/* color band */}
          <div style={{ height: 5, background: LR }} />
          <div style={{ padding: 18, display: "flex", gap: 14 }}>
            <img src={IMG.headphones} alt="" style={{ width: 70, height: 70, borderRadius: 16, objectFit: "cover", flexShrink: 0, border: "1px solid " + P.borderL }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: P.ink, letterSpacing: -0.3, marginBottom: 8 }}>Sony WH-1000XM5</div>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: LR, marginBottom: 5 }}>Lives in</div>
              <Bread room="Living Room" area="TV Stand" color={LR} />
            </div>
          </div>
          <div style={{ padding: "0 18px 14px", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: P.warm }}>
            <Avatar who="sam" size={20} /> Filed by Sam · confirmed 3 days ago
          </div>
          {/* keep-honest actions */}
          <div style={{ display: "flex", gap: 9, padding: "13px 18px", borderTop: "1px solid " + P.borderL, background: P.canvas }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 0", borderRadius: 13, background: P.ink, color: "#fff", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>
              <I.Check size={15} color="#fff" strokeWidth={2.6} /> Still here
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 0", borderRadius: 13, background: P.surface, border: "1.5px solid " + P.border, color: P.inkSoft, fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>
              <I.ArrowRight size={15} color={P.inkSoft} /> Moved it
            </div>
          </div>
        </Card>

        {/* secondary matches, demoted */}
        <Eyebrow>Also matched</Eyebrow>
        <Card>
          {[{ n: "AirPods Pro", img: IMG.earbuds, loc: "Office · Desk" }, { n: "Headphone Stand", img: null, loc: "Office · Shelf" }].map((m, i) => (
            <div key={m.n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: i === 0 ? "1px solid " + P.borderL : "none" }}>
              {m.img ? <img src={m.img} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} /> : <div style={{ width: 40, height: 40, borderRadius: 10, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Inbox size={16} color={P.warm} /></div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: P.ink }}>{m.n}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginTop: 1 }}>{m.loc}</div>
              </div>
              <I.ChevronRight size={15} color={P.border} />
            </div>
          ))}
        </Card>
      </div>
      <BottomNav active="search" />
    </Screen>
  );
}

/* ============================ F2 — full wayfinding answer ============================ */
function F2_Wayfind() {
  const I = window.StowIcons;
  const steps = [
    { label: "Living Room", color: LR, icon: "Home" },
    { label: "TV Stand", color: LR, icon: "Tv" },
  ];
  return (
    <Screen bg={P.surface}>
      <StatusBar />
      {/* header */}
      <div style={{ padding: "2px 16px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 99, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}><I.ChevronLeft size={18} color={P.ink} strokeWidth={2.5} /></div>
        <span style={{ fontSize: 15, fontWeight: 800, color: P.ink, whiteSpace: "nowrap" }}>Where it lives</span>
        <div style={{ width: 40, height: 40, borderRadius: 99, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Edit size={16} color={P.inkMuted} /></div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", padding: "8px 24px 0" }}>
        {/* hero photo + name */}
        <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", marginBottom: 22 }}>
          <img src={IMG.headphones} alt="" style={{ width: "100%", height: 168, objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent 55%)" }} />
          <div style={{ position: "absolute", left: 16, bottom: 13, right: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: -0.3 }}>Sony WH-1000XM5</div>
          </div>
        </div>

        {/* stepping-stone path — recognition over recall */}
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: P.warm, marginBottom: 14, marginLeft: 2 }}>Walk to it</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 22 }}>
          {steps.map((s, i) => {
            const Ic = I[s.icon] || I.Box;
            const last = i === steps.length - 1;
            return (
              <div key={s.label}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: last ? s.color : s.color + "1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ic size={21} color={last ? "#fff" : s.color} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: P.warm }}>{i === 0 ? "Space" : "Area"}</div>
                    <div style={{ fontSize: last ? 19 : 17, fontWeight: 800, color: P.ink, letterSpacing: -0.2 }}>{s.label}</div>
                  </div>
                  {last && <I.MapPin size={20} color={s.color} />}
                </div>
                {!last && <div style={{ width: 2, height: 18, background: P.border, marginLeft: 22, borderRadius: 2 }} />}
              </div>
            );
          })}
        </div>

        {/* trust line */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderRadius: 14, background: P.canvas, border: "1px solid " + P.borderL }}>
          <Avatar who="sam" size={26} />
          <div style={{ fontSize: 12.5, fontWeight: 600, color: P.inkMuted, lineHeight: 1.35 }}>Sam put it here · <span style={{ color: P.ink, fontWeight: 700 }}>confirmed 3 days ago</span></div>
        </div>
      </div>

      {/* keep data honest */}
      <div style={{ padding: "14px 24px 26px", flexShrink: 0, display: "flex", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "15px 0", borderRadius: 15, background: LR, color: "#fff", fontSize: 15, fontWeight: 800, boxShadow: "0 8px 20px " + LR + "44", whiteSpace: "nowrap" }}>
          <I.Check size={17} color="#fff" strokeWidth={2.6} /> It's here
        </div>
        <div style={{ width: 54, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 15, background: P.canvas, border: "1.5px solid " + P.border }}>
          <I.ArrowRight size={19} color={P.inkSoft} />
        </div>
      </div>
    </Screen>
  );
}

/* ============================ F3 — ask in plain language ============================ */
function F3_Ask() {
  const I = window.StowIcons;
  const asks = [
    { q: "Where are my passports?", icon: "MapPin" },
    { q: "What's everything I lent out?", icon: "Users" },
    { q: "Show me my travel gear", icon: "Package" },
    { q: "Anything worth over $200?", icon: "Star" },
  ];
  const recents = [
    { q: "drill", a: "Garage · Toolbox", img: null },
    { q: "fuji camera", a: "Packed · Weekend Trip", img: IMG.camera },
  ];
  return (
    <Screen>
      <StatusBar />
      <div style={{ padding: "10px 22px 14px", borderBottom: "1px solid " + P.borderL, background: P.surface }}>
        <SearchField value="" active />
      </div>
      <div style={{ flex: 1, overflow: "hidden", padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 13, marginLeft: 2 }}>
          <I.Sparkles size={14} color={P.accent} />
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4, color: P.warm, whiteSpace: "nowrap" }}>Just ask Stow</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 26 }}>
          {asks.map((a) => {
            const Ic = I[a.icon] || I.Search;
            return (
              <div key={a.q} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 15, background: P.surface, border: "1px solid " + P.borderL, boxShadow: P.shadowSoft }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: P.accent + "14", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ic size={16} color={P.accent} strokeWidth={2} />
                </div>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: P.inkSoft }}>{a.q}</span>
                <I.ArrowRight size={15} color={P.border} />
              </div>
            );
          })}
        </div>

        <Eyebrow>Recent answers</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recents.map((r) => (
            <div key={r.q} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 13, background: P.canvas }}>
              <I.Clock size={15} color={P.warm} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>“{r.q}”</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginTop: 1 }}>{r.a}</div>
              </div>
              <I.ChevronRight size={14} color={P.border} />
            </div>
          ))}
        </div>
      </div>
      <BottomNav active="search" />
    </Screen>
  );
}

Object.assign(window, { EX_FIND: { F1_Answer, F2_Wayfind, F3_Ask } });
