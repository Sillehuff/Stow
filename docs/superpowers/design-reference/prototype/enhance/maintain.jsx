/* Enhancement 2 — Item status & lending: lifecycle made a first-class,
   glanceable property so nothing silently disappears.
   Frames exported to window.EX_KEEP. */

const { P, StatusBar, Screen } = window.MG;
const { IMG, STATUS, PEOPLE, Avatar, StatusPill, BottomNav, Brand, Eyebrow, Card } = window.EX;

/* ============================ M1 — home surfaces what's "away" ============================ */
function M1_AwayHome() {
  const I = window.StowIcons;
  const away = [
    { name: "Cordless Drill", img: null, icon: "Wrench", status: "lent", who: "marcus", meta: "3 weeks", overdue: true },
    { name: "Fuji X-T5", img: IMG.camera, status: "packed", meta: "Weekend Trip" },
    { name: "Blue Yeti Mic", img: IMG.mic, status: "repair", meta: "since Apr 2" },
  ];
  const spaces = [
    { name: "Living Room", color: "#E8652B", icon: "Home", sub: "3 areas · 3 items" },
    { name: "Office", color: "#5B6ABF", icon: "Briefcase", sub: "3 areas · 2 items" },
  ];
  return (
    <Screen>
      <StatusBar />
      <Brand sub="10 items · 4 spaces · 3 away" />
      <div style={{ flex: 1, overflow: "hidden", padding: "10px 22px 0" }}>
        {/* AWAY — the new glanceable strip */}
        <Eyebrow count={3} countColor={P.accent}>Away from home</Eyebrow>
        <Card style={{ borderRadius: 18, marginBottom: 22 }}>
          {away.map((it, i) => {
            const Ic = I[it.icon] || I.Inbox;
            return (
              <div key={it.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < away.length - 1 ? "1px solid " + P.borderL : "none" }}>
                {it.img
                  ? <img src={it.img} alt="" style={{ width: 42, height: 42, borderRadius: 11, objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 42, height: 42, borderRadius: 11, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic size={18} color={P.warm} /></div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
                    <StatusPill status={it.status} small />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: it.overdue ? P.danger : P.warm, display: "flex", alignItems: "center", gap: 4 }}>
                      {it.who && <Avatar who={it.who} size={16} />}
                      {it.who ? PEOPLE[it.who].name.split(" ")[0] + " · " : ""}{it.meta}
                    </span>
                  </div>
                </div>
                {it.overdue && <div style={{ fontSize: 11, fontWeight: 800, color: P.accent, background: P.accent + "16", borderRadius: 99, padding: "5px 10px", whiteSpace: "nowrap" }}>Nudge</div>}
              </div>
            );
          })}
        </Card>

        <Eyebrow>Your spaces</Eyebrow>
        <Card>
          {spaces.map((s, i) => {
            const Ic = I[s.icon] || I.Box;
            return (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: i === 0 ? "1px solid " + P.borderL : "none" }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: s.color + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic size={19} color={s.color} strokeWidth={1.9} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: P.ink }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginTop: 1 }}>{s.sub}</div>
                </div>
                <I.ChevronRight size={15} color={P.border} />
              </div>
            );
          })}
        </Card>
      </div>
      <BottomNav active="spaces" />
    </Screen>
  );
}

/* ============================ M2 — status selector w/ progressive disclosure ============================ */
function M2_StatusSheet() {
  const I = window.StowIcons;
  const order = ["home", "packed", "lent", "repair", "lost"];
  return (
    <Screen bg={P.surface}>
      <StatusBar />
      {/* dimmed item-detail behind */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        <div style={{ height: 150, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Wrench size={42} color={P.border} /></div>
        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 21, fontWeight: 900, color: P.ink }}>Cordless Drill</div>
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)" }} />

      {/* sheet */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: P.surface, borderRadius: "26px 26px 0 0", boxShadow: "0 -10px 40px rgba(0,0,0,0.2)", paddingBottom: 26 }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 11 }}><div style={{ width: 36, height: 5, borderRadius: 99, background: P.border }} /></div>
        <div style={{ padding: "10px 24px 4px" }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: P.ink }}>Status</h2>
        </div>

        <div style={{ padding: "10px 24px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {order.map((k) => {
            const s = STATUS[k];
            const Ic = I[s.icon];
            const sel = k === "lent";
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 14px", borderRadius: 14, background: sel ? s.soft : P.canvas, border: "1.5px solid " + (sel ? s.color : "transparent") }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: sel ? s.color : P.surface, border: sel ? "none" : "1px solid " + P.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ic size={17} color={sel ? "#fff" : s.color} strokeWidth={2} />
                </div>
                <span style={{ flex: 1, fontSize: 15.5, fontWeight: 700, color: P.ink }}>{s.label}</span>
                {sel && <div style={{ width: 22, height: 22, borderRadius: 99, background: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Check size={13} color="#fff" strokeWidth={3} /></div>}
              </div>
            );
          })}
        </div>

        {/* progressive disclosure: lending details appear only for "Lent out" */}
        <div style={{ margin: "16px 24px 0", padding: 16, borderRadius: 16, background: STATUS.lent.soft, border: "1px solid " + STATUS.lent.color + "33" }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: STATUS.lent.color, marginBottom: 12 }}>Loan details</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            {["marcus", "sam", "jess"].map((w) => (
              <div key={w} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <Avatar who={w} size={42} ring={w === "marcus"} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: w === "marcus" ? P.ink : P.warm }}>{PEOPLE[w].name.split(" ")[0]}</span>
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ width: 42, height: 42, borderRadius: 99, border: "1.5px dashed " + P.warm, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Plus size={17} color={P.warm} /></div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: P.warm }}>Other</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: P.surface, border: "1px solid " + P.borderL }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <I.Bell size={16} color={STATUS.lent.color} />
              <span style={{ fontSize: 14, fontWeight: 700, color: P.ink, whiteSpace: "nowrap" }}>Remind me to follow up</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: STATUS.lent.color, whiteSpace: "nowrap" }}>in 2 weeks ›</span>
          </div>
        </div>

        <div style={{ margin: "16px 24px 0", padding: "15px 0", borderRadius: 15, background: P.ink, color: "#fff", textAlign: "center", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap" }}>
          Save · Lent to Marcus
        </div>
      </div>
    </Screen>
  );
}

/* ============================ M3 — loans the system remembers ============================ */
function M3_Loans() {
  const I = window.StowIcons;
  const groups = [
    { who: "marcus", items: [{ n: "Cordless Drill", since: "3 weeks ago", overdue: true, icon: "Wrench" }, { n: "Camping Lantern", since: "3 weeks ago", overdue: true, icon: "Sun" }] },
    { who: "jess", items: [{ n: "Stand Mixer", since: "5 days ago", img: null, icon: "Coffee" }] },
  ];
  return (
    <Screen>
      <StatusBar />
      <div style={{ padding: "2px 22px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: P.ink, letterSpacing: -0.5, fontFamily: "var(--mg-display)" }}>Lent out</h1>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: P.warm }}>3 items · 2 people</div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", padding: "8px 22px 0" }}>
        {/* gentle reminder banner — knowledge in the world, not in your head */}
        <div style={{ display: "flex", gap: 12, padding: 15, borderRadius: 16, background: P.accent + "12", border: "1px solid " + P.accent + "2E", marginBottom: 20 }}>
          <I.Bell size={19} color={P.accent} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.4, color: P.inkSoft, fontWeight: 600 }}>
            Marcus has had <b style={{ color: P.ink }}>2 of your things</b> for 3 weeks. Want to check in?
            <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
              <div style={{ padding: "8px 15px", borderRadius: 10, background: P.accent, color: "#fff", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}>Send a nudge</div>
              <div style={{ padding: "8px 15px", borderRadius: 10, background: P.surface, border: "1px solid " + P.border, color: P.inkSoft, fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}>Snooze</div>
            </div>
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.who} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10, marginLeft: 2 }}>
              <Avatar who={g.who} size={26} />
              <span style={{ fontSize: 14, fontWeight: 800, color: P.ink }}>{PEOPLE[g.who].name}</span>
            </div>
            <Card>
              {g.items.map((it, i) => {
                const Ic = I[it.icon] || I.Inbox;
                return (
                  <div key={it.n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < g.items.length - 1 ? "1px solid " + P.borderL : "none" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic size={17} color={P.warm} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink }}>{it.n}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: it.overdue ? P.danger : P.warm, marginTop: 1 }}>{it.overdue ? "Out " + it.since : "Lent " + it.since}</div>
                    </div>
                    <div style={{ padding: "7px 13px", borderRadius: 10, background: P.successSoft || "#EAFAF2", color: P.success, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>Returned</div>
                  </div>
                );
              })}
            </Card>
          </div>
        ))}
      </div>
      <BottomNav active="packing" />
    </Screen>
  );
}

Object.assign(window, { EX_KEEP: { M1_AwayHome, M2_StatusSheet, M3_Loans } });
