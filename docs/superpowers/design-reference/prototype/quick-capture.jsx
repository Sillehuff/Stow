/* Stow — Quick Capture ("capture a whole shot").
   One still frame → analyze on-device → review a confidence-ranked stack
   (least sure first) → batch-commit the kept items to inventory.
   A genuinely interactive port of the UX-enhancement study. Exported to window.StowScreens. */
(function () {
  const { useState, useEffect } = React;

  const AMBER = "#C9821F";
  /* Wide desk shot used as the captured frame. */
  const FEED = "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=900&q=80";

  /* Results of analyzing the single still. Each carries a match confidence.
     `box` positions the detection overlay on the frozen frame. */
  const DETECTED = [
    { id: "kbd", name: "Mechanical Keyboard", img: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=400&q=80", value: 140, tags: ["Tech", "Work"], pct: 97, conf: "high", box: { top: "15%", left: "11%", w: "45%", h: "29%", delay: 0.15 } },
    { id: "hp", name: "Sony WH-1000XM5", img: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80", value: 250, tags: ["Tech", "Audio"], pct: 95, conf: "high", box: { top: "19%", left: "63%", w: "27%", h: "23%", delay: 0.3 } },
    { id: "watch", name: "Apple Watch", img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80", value: 400, tags: ["Tech"], pct: 61, conf: "low", guesses: ["Apple Watch", "Garmin Fenix", "Something else"], box: { top: "51%", left: "31%", w: "39%", h: "25%", delay: 0.45 } },
    { id: "unk", name: "", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80", value: 0, tags: [], pct: 44, conf: "low", unknown: true, box: { top: "70%", left: "9%", w: "26%", h: "17%", delay: 0.6 } },
  ];
  /* Review order: least confident first. */
  const ORDER = DETECTED.slice().sort((a, b) => a.pct - b.pct);
  const lowCount = DETECTED.filter((d) => d.conf === "low").length;

  function QuickCapture({ c }) {
    const { P, I, act } = c;
    const [phase, setPhase] = useState("analyzing"); // analyzing | detected | review | done
    const [idx, setIdx] = useState(0);
    const [kept, setKept] = useState([]);            // [{...detected, name}]
    const [skipped, setSkipped] = useState(0);
    const [names, setNames] = useState({});          // id -> chosen name
    const [renaming, setRenaming] = useState(false);
    const [picker, setPicker] = useState(false);

    const room0 = c.rooms.find((r) => r.id === c.roomId) || c.rooms[0];
    const [dest, setDest] = useState({ roomId: room0.id, area: (c.areaFilter && c.areaFilter !== "All") ? c.areaFilter : (room0.areas[0] ? room0.areas[0].name : "") });
    const destRoom = c.rooms.find((r) => r.id === dest.roomId) || room0;

    useEffect(() => {
      if (phase !== "analyzing") return;
      const t = setTimeout(() => setPhase("detected"), 2700);
      return () => clearTimeout(t);
    }, [phase]);

    const nameOf = (d) => names[d.id] || d.name;
    const cur = ORDER[idx];

    const advance = () => {
      setRenaming(false);
      if (idx + 1 >= ORDER.length) setPhase("done");
      else setIdx(idx + 1);
    };
    const confirm = () => {
      const nm = (nameOf(cur) || "").trim();
      if (!nm) { setRenaming(true); return; }   // unknown must be named first
      setKept((prev) => prev.concat([{ ...cur, name: nm }]));
      advance();
    };
    const skip = () => { setSkipped((s) => s + 1); advance(); };

    const commit = () => {
      const stamp = Date.now();
      const newItems = kept.map((d, i) => ({
        id: "i" + stamp + i, name: d.name, roomId: dest.roomId, area: dest.area,
        isPacked: false, image: d.img, value: d.value, tags: d.tags,
        notes: "Added via Quick Capture", createdAt: "2026-06-06",
      }));
      act.commitCapture(newItems);
    };

    /* ── shared destination pill ── */
    const DestPill = ({ light }) => (
      <button onClick={() => setPicker(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, border: "1.5px solid " + (light ? "rgba(255,255,255,0.28)" : P.border), background: light ? "rgba(255,255,255,0.14)" : P.surface, color: light ? "#fff" : P.ink, backdropFilter: light ? "blur(10px)" : "none" }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, background: destRoom.color, flexShrink: 0 }} />
        {destRoom.name} · {dest.area}
        <I.ChevronDown size={13} color={light ? "rgba(255,255,255,0.8)" : P.inkMuted} />
      </button>
    );

    /* ============================ destination picker ============================ */
    if (picker) {
      return (
        <div style={{ position: "absolute", inset: 0, zIndex: 92, background: P.canvas, display: "flex", flexDirection: "column", animation: "stowUp 0.26s ease-out" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 20px 14px", borderBottom: "1px solid " + P.borderL }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: P.ink }}>File these in…</div>
            <button onClick={() => setPicker(false)} style={{ fontSize: 15, fontWeight: 700, color: P.accent, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Done</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 28px" }}>
            {c.rooms.map((rm) => (
              <div key={rm.id} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: rm.color }} />
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: P.ink }}>{rm.name}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {rm.areas.map((a) => {
                    const on = dest.roomId === rm.id && dest.area === a.name;
                    return (
                      <button key={a.name} onClick={() => { setDest({ roomId: rm.id, area: a.name }); setPicker(false); }}
                        style={{ padding: "9px 14px", borderRadius: P.radius, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "1.5px solid " + (on ? rm.color : P.border), background: on ? "color-mix(in srgb, " + rm.color + " 14%, " + P.surface + ")" : P.surface, color: on ? P.ink : P.inkMuted }}>
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    /* ============================ analyzing / detected (frozen frame) ============================ */
    if (phase === "analyzing" || phase === "detected") {
      const analyzing = phase === "analyzing";
      return (
        <div style={{ position: "absolute", inset: 0, zIndex: 90, background: "#0A0A12", overflow: "hidden", animation: "stowUp 0.3s ease-out" }}>
          <img src={FEED} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.82, filter: "saturate(0.92)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(10,10,18,0.6), rgba(10,10,18,0.05) 30%, rgba(10,10,18,0.2) 64%, rgba(10,10,18,0.92))" }} />

          {/* frozen-frame corner brackets */}
          {[["t", "l"], ["t", "r"], ["b", "l"], ["b", "r"]].map(([v, h]) => (
            <div key={v + h} style={{ position: "absolute", width: 26, height: 26, zIndex: 3, [v === "t" ? "top" : "bottom"]: 104, [h === "l" ? "left" : "right"]: 22, [v === "t" ? "borderTop" : "borderBottom"]: "2.5px solid rgba(255,255,255,0.7)", [h === "l" ? "borderLeft" : "borderRight"]: "2.5px solid rgba(255,255,255,0.7)", borderRadius: h === "l" ? (v === "t" ? "6px 0 0 0" : "0 0 0 6px") : (v === "t" ? "0 6px 0 0" : "0 0 6px 0") }} />
          ))}

          {/* scan sweep while analyzing */}
          {analyzing && (
            <div style={{ position: "absolute", inset: 0, zIndex: 3, overflow: "hidden", pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: 0, right: 0, height: 64, background: "linear-gradient(to bottom, rgba(232,101,43,0), " + P.accent + "47 70%, rgba(255,255,255,0.55))", borderBottom: "2px solid " + P.accent, animation: "capSweep 2.8s ease-in-out infinite" }} />
            </div>
          )}

          {/* top chrome */}
          <div style={{ position: "absolute", top: 54, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", zIndex: 5 }}>
            <button onClick={act.closeQuickCapture} style={{ width: 38, height: 38, borderRadius: 99, background: "rgba(255,255,255,0.16)", border: "none", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><I.X size={17} color="#fff" /></button>
            {analyzing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#fff", fontSize: 12.5, fontWeight: 800, background: "rgba(255,255,255,0.16)", backdropFilter: "blur(10px)", padding: "8px 14px", borderRadius: 99 }}>
                <I.ScanLine size={13} color={P.accent} /> Analyzing frame
                <span style={{ display: "inline-flex", gap: 2 }}>
                  {[0, 1, 2].map((d) => <span key={d} style={{ width: 3, height: 3, borderRadius: 99, background: "#fff", animation: "capDots 1.1s ease-in-out infinite", animationDelay: d * 0.16 + "s" }} />)}
                </span>
              </div>
            ) : <DestPill light />}
            <div style={{ width: 38 }} />
          </div>

          {/* detection boxes */}
          <div style={{ position: "absolute", inset: 0, zIndex: 4 }}>
            {DETECTED.map((d) => {
              const low = d.conf === "low";
              const col = low ? AMBER : P.accent;
              const rightAligned = (parseFloat(d.box.left) + parseFloat(d.box.w)) > 74;
              return (
                <div key={d.id} style={{ position: "absolute", top: d.box.top, left: d.box.left, width: d.box.w, height: d.box.h, border: "2.5px " + (low ? "dashed" : "solid") + " " + col, borderRadius: 12, boxShadow: low ? "inset 0 0 26px rgba(201,130,31,0.14)" : "0 0 0 2px " + P.accent + "38, inset 0 0 28px " + P.accent + "1A" }}>
                  <div style={{ position: "absolute", top: -11, [rightAligned ? "right" : "left"]: 8, display: "inline-flex", alignItems: "center", gap: 4, background: col, color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 7, whiteSpace: "nowrap", maxWidth: 150, overflow: "hidden" }}>
                    {low && <I.HelpCircle size={11} color="#fff" />}
                    {d.unknown ? "?" : (low ? "?" : d.name)} <span style={{ opacity: 0.82 }}>{d.pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* bottom: count + actions */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 22px 38px", zIndex: 5 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 15px", borderRadius: 99, background: "rgba(255,255,255,0.16)", backdropFilter: "blur(14px)", color: "#fff", fontSize: 13, fontWeight: 800 }}>
                {analyzing ? <React.Fragment><I.ScanLine size={14} color={P.accent} /> Reading the shelf…</React.Fragment>
                  : <React.Fragment><I.Check size={14} color={P.success} strokeWidth={3} /> {DETECTED.length} found
                    <span style={{ width: 3, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.5)" }} />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#FFD9A6" }}><I.AlertTriangle size={12} color="#FFD9A6" /> {lowCount} need a look</span></React.Fragment>}
              </div>
            </div>
            {!analyzing && (
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <button onClick={() => { setPhase("analyzing"); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 18px", height: 52, borderRadius: 15, background: "rgba(255,255,255,0.14)", backdropFilter: "blur(10px)", border: "1.5px solid rgba(255,255,255,0.28)", color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  <I.RotateCcw size={16} color="#fff" /> Rescan
                </button>
                <button onClick={() => setPhase("review")} style={{ flex: 1, height: 52, borderRadius: 15, background: P.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 10px 24px " + P.accent + "55" }}>
                  Review {DETECTED.length} items <I.ArrowRight size={17} color="#fff" />
                </button>
              </div>
            )}
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <I.Camera size={12} color="rgba(255,255,255,0.6)" /> One still frame, read on-device — not live video
            </div>
          </div>
        </div>
      );
    }

    /* ============================ review stack ============================ */
    if (phase === "review") {
      const low = cur.conf === "low";
      const col = low ? AMBER : P.success;
      const chip = (icon, text, tint) => {
        const Ic = I[icon];
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 99, background: tint ? P.accentSoft : P.canvas, border: "1px solid " + (tint ? P.accent + "33" : P.border), fontSize: 12, fontWeight: 700, color: tint ? P.accent : P.inkSoft }}>
            <Ic size={12} color={tint ? P.accent : P.inkMuted} /> {text}
          </span>
        );
      };
      return (
        <div style={{ position: "absolute", inset: 0, zIndex: 90, background: P.canvas, display: "flex", flexDirection: "column", paddingTop: 50, animation: "stowUp 0.3s ease-out" }}>
          {/* header */}
          <div style={{ padding: "8px 22px 4px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button onClick={act.closeQuickCapture} style={{ width: 34, height: 34, borderRadius: 99, background: P.surface, border: "1px solid " + P.border, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><I.X size={16} color={P.inkMuted} /></button>
            <span style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 800, color: P.ink, whiteSpace: "nowrap" }}>Review {ORDER.length} items</span>
            <div style={{ width: 34, flexShrink: 0 }} />
          </div>
          <div style={{ padding: "6px 22px 8px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <I.AlertTriangle size={12} color={AMBER} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: P.inkMuted }}>Least sure first — confirm these, then breeze through the rest</span>
          </div>

          {/* progress dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 13, flexShrink: 0 }}>
            {ORDER.map((d, i) => {
              const done = i < idx;
              const active = i === idx;
              const base = d.conf === "low" ? AMBER : P.success;
              return <div key={d.id} style={{ width: active ? 22 : 7, height: 7, borderRadius: 99, background: done ? base : active ? base : P.border, opacity: done ? 0.4 : 1, transition: "all .2s" }} />;
            })}
          </div>

          {/* card */}
          <div style={{ flex: 1, position: "relative", padding: "0 22px" }}>
            <div style={{ position: "absolute", left: 38, right: 38, top: 14, height: 120, borderRadius: 22, background: P.surface, border: "1px solid " + P.borderL, boxShadow: P.shadowSoft, borderTop: "3px solid " + P.border }} />
            {idx + 1 < ORDER.length && <div style={{ position: "absolute", left: 30, right: 30, top: 8, height: 130, borderRadius: 22, background: P.surface, border: "1px solid " + P.borderL, boxShadow: P.shadow, borderTop: "3px solid " + (ORDER[idx + 1].conf === "low" ? AMBER : P.success) }} />}

            <div style={{ position: "relative", background: P.surface, borderRadius: 22, border: "1px solid " + P.borderL, boxShadow: "0 16px 40px rgba(0,0,0,0.13)", overflow: "hidden" }}>
              <div style={{ height: 4, background: col }} />
              <div style={{ position: "relative" }}>
                <img src={cur.img} alt="" style={{ width: "100%", height: 150, objectFit: "cover", display: "block", filter: cur.unknown ? "blur(1.5px) brightness(0.8)" : "none" }} />
                <div style={{ position: "absolute", top: 12, left: 12, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 99, background: col, color: "#fff", fontSize: 11, fontWeight: 800 }}>
                  {low ? <React.Fragment><I.AlertTriangle size={11} color="#fff" /> Low confidence</React.Fragment>
                    : <React.Fragment><I.Check size={11} color="#fff" strokeWidth={3} /> Confident</React.Fragment>}
                </div>
                <div style={{ position: "absolute", top: 12, right: 12, padding: "5px 11px", borderRadius: 99, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", color: "#fff", fontSize: 11, fontWeight: 800 }}>{idx + 1} of {ORDER.length}</div>
                <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,0.35)", overflow: "hidden" }}>
                    <div style={{ width: cur.pct + "%", height: "100%", background: col, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{cur.pct}% match</span>
                </div>
              </div>

              <div style={{ padding: "14px 18px 18px" }}>
                {cur.unknown ? (
                  <React.Fragment>
                    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: AMBER, marginBottom: 8 }}>Couldn't identify — name it or skip</div>
                    <input autoFocus value={names[cur.id] || ""} onChange={(e) => setNames((p) => ({ ...p, [cur.id]: e.target.value }))} placeholder="e.g. Wireless Earbuds"
                      style={{ width: "100%", boxSizing: "border-box", borderRadius: P.radius + 2, padding: "12px 15px", fontSize: 15, fontWeight: 600, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit", marginBottom: 14 }} />
                  </React.Fragment>
                ) : low ? (
                  <React.Fragment>
                    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: AMBER, marginBottom: 8 }}>Best guess — confirm which</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                      {cur.guesses.map((g) => {
                        const on = nameOf(cur) === g;
                        return (
                          <button key={g} onClick={() => setNames((p) => ({ ...p, [cur.id]: g }))}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 11, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", background: on ? P.ink : P.canvas, color: on ? "#fff" : P.inkSoft, border: "1.5px solid " + (on ? P.ink : P.border) }}>
                            {on && <I.Check size={13} color="#fff" strokeWidth={3} />}{g}
                          </button>
                        );
                      })}
                    </div>
                  </React.Fragment>
                ) : renaming ? (
                  <input autoFocus value={nameOf(cur)} onChange={(e) => setNames((p) => ({ ...p, [cur.id]: e.target.value }))}
                    style={{ width: "100%", boxSizing: "border-box", borderRadius: P.radius + 2, padding: "12px 15px", fontSize: 17, fontWeight: 800, outline: "none", border: "1.5px solid " + P.accent, background: P.canvas, color: P.ink, fontFamily: "inherit", marginBottom: 14 }} />
                ) : (
                  <div style={{ fontSize: 19, fontWeight: 800, color: P.ink, letterSpacing: -0.3, marginBottom: 14 }}>{nameOf(cur)}</div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button onClick={() => setPicker(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 99, background: P.accentSoft, border: "1px solid " + P.accent + "33", fontSize: 12, fontWeight: 700, color: P.accent, cursor: "pointer", fontFamily: "inherit" }}>
                    <I.MapPin size={12} color={P.accent} /> {destRoom.name} · {dest.area} <I.ChevronDown size={12} color={P.accent} />
                  </button>
                  {cur.value ? chip("DollarSign", "$" + cur.value) : null}
                  {cur.tags.slice(0, 1).map((tg) => chip("Tag", tg))}
                </div>
              </div>
            </div>

            {/* triage actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 22 }}>
              <button onClick={skip} title="Skip" style={{ width: 56, height: 56, borderRadius: 99, background: P.surface, border: "1.5px solid " + P.border, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: P.shadowSoft, cursor: "pointer" }}>
                <I.X size={22} color={P.warm} strokeWidth={2.4} />
              </button>
              <button onClick={confirm} style={{ flex: 1, maxWidth: 168, height: 56, borderRadius: 99, background: P.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15, fontWeight: 800, boxShadow: "0 10px 22px " + P.accent + "55", border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                <I.Check size={19} color="#fff" strokeWidth={2.6} /> Confirm &amp; add
              </button>
              <button onClick={() => setRenaming((v) => !v)} title="Rename" style={{ width: 56, height: 56, borderRadius: 99, background: renaming ? P.accentSoft : P.surface, border: "1.5px solid " + (renaming ? P.accent : P.border), display: "flex", alignItems: "center", justifyContent: "center", boxShadow: P.shadowSoft, cursor: "pointer" }}>
                <I.Edit size={20} color={renaming ? P.accent : P.inkSoft} />
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 13, fontSize: 11.5, fontWeight: 600, color: P.warm }}>Confirm to add · skip to discard</div>
          </div>
        </div>
      );
    }

    /* ============================ done ============================ */
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 90, background: P.canvas, display: "flex", flexDirection: "column", paddingTop: 50, animation: "stowUp 0.3s ease-out" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 0" }}>
          <div style={{ textAlign: "center", marginTop: 14, marginBottom: 22 }}>
            <div style={{ width: 64, height: 64, borderRadius: 99, background: P.successSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <I.Check size={32} color={P.success} strokeWidth={2.6} />
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 900, color: P.ink, letterSpacing: -0.4, fontFamily: "var(--stow-display)" }}>{kept.length} item{kept.length !== 1 ? "s" : ""} filed</h1>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: P.inkSoft }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: destRoom.color }} /> {destRoom.name} <I.ChevronRight size={13} color={P.warm} /> {dest.area}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {kept.map((it) => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14, background: P.surface, border: "1px solid " + P.borderL, boxShadow: P.shadowSoft }}>
                <img src={it.img} alt="" style={{ width: 44, height: 44, borderRadius: 11, objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
                  {it.value ? <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginTop: 1 }}>${it.value}</div> : null}
                </div>
                <div style={{ width: 22, height: 22, borderRadius: 99, background: P.successSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <I.Check size={13} color={P.success} strokeWidth={3} />
                </div>
              </div>
            ))}
            {kept.length === 0 && (
              <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, fontWeight: 600, color: P.warm }}>Nothing added — everything was skipped.</div>
            )}
            {skipped > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", fontSize: 12.5, fontWeight: 600, color: P.warm }}>
                <I.X size={14} color={P.warm} /> {skipped} skipped · not added
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "12px 24px 28px", flexShrink: 0 }}>
          <button onClick={commit} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 0", borderRadius: 15, background: P.ink, color: "#fff", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Done</button>
        </div>
      </div>
    );
  }

  window.StowScreens = window.StowScreens || {};
  Object.assign(window.StowScreens, { QuickCapture });
})();
