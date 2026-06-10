/* Enhancement 3 — Quick Capture: add a whole shelf in one shot.
   Capture ONE still frame → analyze it on-device → review a confidence-ranked
   stack (least-sure first) → confirm the batch. Snapshot model, not live video.
   Frames exported to window.EX_CAP. */

const { P, StatusBar, Screen } = window.MG;
const { IMG, Avatar, Bread, BottomNav, Eyebrow, Card } = window.EX;

const LR = "#5B6ABF"; // Office color
const AMBER = "#C9821F"; // low-confidence / verify treatment
const AMBER_SOFT = "#FBF1DD";

/* ============================ C1 — captured frame, being analyzed ============================ */
function C1_Detect() {
  const I = window.StowIcons;
  // Boxes = results of analyzing ONE captured still. Each carries a match confidence;
  // low-confidence detections render dashed + amber so the uncertainty is visible up front.
  const boxes = [
    { top: "15%", left: "11%", w: "45%", h: "29%", label: "Keyboard", pct: 97, conf: "high", delay: 0.15 },
    { top: "19%", left: "63%", w: "27%", h: "23%", label: "Headphones", pct: 95, conf: "high", delay: 0.3 },
    { top: "51%", left: "31%", w: "39%", h: "25%", label: "Watch", pct: 61, conf: "low", delay: 0.45 },
    { top: "70%", left: "9%", w: "26%", h: "17%", label: "Unknown", pct: 44, conf: "low", delay: 0.6 },
  ];
  return (
    <Screen bg="#0A0A12">
      <div style={{ position: "absolute", inset: 0 }}>
        <img src={IMG.feed} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.82, filter: "saturate(0.92)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(10,10,18,0.6), rgba(10,10,18,0.08) 28%, rgba(10,10,18,0.2) 66%, rgba(10,10,18,0.9))" }} />
      </div>

      {/* frozen-frame corner brackets — this is a still, not a live feed */}
      <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
        {[["t", "l"], ["t", "r"], ["b", "l"], ["b", "r"]].map(([v, h]) => (
          <div key={v + h} style={{ position: "absolute", width: 26, height: 26, [v === "t" ? "top" : "bottom"]: 96, [h === "l" ? "left" : "right"]: 22, [v === "t" ? "borderTop" : "borderBottom"]: "2.5px solid rgba(255,255,255,0.7)", [h === "l" ? "borderLeft" : "borderRight"]: "2.5px solid rgba(255,255,255,0.7)", borderRadius: h === "l" ? (v === "t" ? "6px 0 0 0" : "0 0 0 6px") : (v === "t" ? "0 6px 0 0" : "0 0 6px 0") }} />
        ))}
      </div>

      {/* analysis scan sweep — a single still being read top-to-bottom */}
      <div style={{ position: "absolute", inset: 0, zIndex: 3, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 64, background: "linear-gradient(to bottom, rgba(232,101,43,0), rgba(232,101,43,0.28) 70%, rgba(255,255,255,0.55))", borderBottom: "2px solid " + P.accent, animation: "capSweep 2.8s ease-in-out infinite" }} />
      </div>

      {/* status bar (light) */}
      <div style={{ position: "relative", zIndex: 2 }}><StatusBar dark /></div>

      {/* top chrome */}
      <div style={{ position: "absolute", top: 52, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", zIndex: 5 }}>
        <div style={{ width: 38, height: 38, borderRadius: 99, background: "rgba(255,255,255,0.16)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center" }}><I.X size={17} color="#fff" /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#fff", fontSize: 12.5, fontWeight: 800, background: "rgba(255,255,255,0.16)", backdropFilter: "blur(10px)", padding: "8px 14px", borderRadius: 99 }}>
          <I.ScanLine size={13} color={P.accent} />
          <span>Analyzing frame</span>
          <span style={{ display: "inline-flex", gap: 2 }}>
            {[0, 1, 2].map((d) => <span key={d} style={{ width: 3, height: 3, borderRadius: 99, background: "#fff", animation: "capDots 1.1s ease-in-out infinite", animationDelay: d * 0.16 + "s" }} />)}
          </span>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 99, background: "rgba(255,255,255,0.16)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center" }}><I.Sun size={17} color="#fff" /></div>
      </div>

      {/* detection boxes — confidence-coded, popped in as they resolve */}
      <div style={{ position: "absolute", inset: 0, zIndex: 4 }}>
        {boxes.map((b) => {
          const low = b.conf === "low";
          const c = low ? AMBER : P.accent;
          return (
            <div key={b.label} style={{ position: "absolute", top: b.top, left: b.left, width: b.w, height: b.h, border: "2.5px " + (low ? "dashed" : "solid") + " " + c, borderRadius: 12, boxShadow: low ? "inset 0 0 26px rgba(201,130,31,0.14)" : "0 0 0 2px rgba(232,101,43,0.22), inset 0 0 28px rgba(232,101,43,0.1)", animation: "capPop .45s cubic-bezier(.2,.9,.3,1.2) both", animationDelay: b.delay + "s" }}>
              <div style={{ position: "absolute", top: -11, left: 8, display: "inline-flex", alignItems: "center", gap: 4, background: c, color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 7, whiteSpace: "nowrap" }}>
                {low && <I.HelpCircle size={11} color="#fff" />}
                {low ? "?" : b.label} <span style={{ opacity: 0.82, fontWeight: 700 }}>{b.pct}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* bottom: honest snapshot framing + rescan / proceed */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 22px 34px", zIndex: 5 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 15px", borderRadius: 99, background: "rgba(255,255,255,0.16)", backdropFilter: "blur(14px)", color: "#fff", fontSize: 13, fontWeight: 800 }}>
            <I.Check size={14} color={P.success} strokeWidth={3} /> 4 found
            <span style={{ width: 3, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.5)" }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#FFD9A6" }}><I.AlertTriangle size={12} color="#FFD9A6" /> 2 need a look</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 18px", height: 52, borderRadius: 15, background: "rgba(255,255,255,0.14)", backdropFilter: "blur(10px)", border: "1.5px solid rgba(255,255,255,0.28)", color: "#fff", fontSize: 13.5, fontWeight: 800 }}>
            <I.RotateCcw size={16} color="#fff" /> Rescan
          </div>
          <div style={{ flex: 1, height: 52, borderRadius: 15, background: P.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15, fontWeight: 800, boxShadow: "0 10px 24px rgba(232,101,43,0.45)" }}>
            Review 4 items <I.ArrowRight size={17} color="#fff" />
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <I.Camera size={12} color="rgba(255,255,255,0.6)" /> One still frame, read on-device — not live video
        </div>
      </div>
    </Screen>
  );
}

/* ============================ C2 — review stack, least-confident first ============================ */
function C2_Review() {
  const I = window.StowIcons;
  const chip = (icon, text, tint) => {
    const Ic = I[icon];
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 99, background: tint ? P.accent + "14" : P.canvas, border: "1px solid " + (tint ? P.accent + "33" : P.border), fontSize: 12, fontWeight: 700, color: tint ? P.accent : P.inkSoft }}>
        <Ic size={12} color={tint ? P.accent : P.inkMuted} /> {text}
      </span>
    );
  };
  // model's ranked guesses for the uncertain item — first is selected by default
  const guesses = [{ n: "Apple Watch", on: true }, { n: "Garmin Fenix", on: false }, { n: "Something else", on: false }];
  return (
    <Screen bg={P.canvas}>
      <StatusBar />
      <div style={{ padding: "2px 22px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: P.ink, whiteSpace: "nowrap" }}>Review 4 items</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: P.accent, whiteSpace: "nowrap" }}>Add all ›</span>
      </div>
      <div style={{ padding: "0 22px 10px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <I.AlertTriangle size={12} color={AMBER} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: P.inkMuted }}>Least sure first — confirm these, then breeze through the rest</span>
      </div>

      {/* progress dots — 4 items, the two amber ones are the uncertain ones up front */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 13, flexShrink: 0 }}>
        {[{ c: AMBER, a: true }, { c: AMBER }, { c: P.border }, { c: P.border }].map((d, i) => (
          <div key={i} style={{ width: d.a ? 22 : 7, height: 7, borderRadius: 99, background: d.c, transition: "all .2s" }} />
        ))}
      </div>

      <div style={{ flex: 1, position: "relative", padding: "0 22px" }}>
        {/* peeked cards behind — amber edge = another uncertain one queued next */}
        <div style={{ position: "absolute", left: 38, right: 38, top: 14, height: 120, borderRadius: 22, background: P.surface, border: "1px solid " + P.borderL, boxShadow: P.shadowSoft, borderTop: "3px solid " + P.border }} />
        <div style={{ position: "absolute", left: 30, right: 30, top: 8, height: 130, borderRadius: 22, background: P.surface, border: "1px solid " + P.borderL, boxShadow: P.shadow, borderTop: "3px solid " + AMBER }} />

        {/* top card — LOW CONFIDENCE, needs verification */}
        <div style={{ position: "relative", background: P.surface, borderRadius: 22, border: "1px solid " + P.borderL, boxShadow: "0 16px 40px rgba(0,0,0,0.13)", overflow: "hidden" }}>
          <div style={{ height: 4, background: AMBER }} />
          <div style={{ position: "relative" }}>
            <img src={IMG.watch} alt="" style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", top: 12, left: 12, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 99, background: AMBER, color: "#fff", fontSize: 11, fontWeight: 800 }}>
              <I.AlertTriangle size={11} color="#fff" /> Low confidence
            </div>
            <div style={{ position: "absolute", top: 12, right: 12, padding: "5px 11px", borderRadius: 99, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", color: "#fff", fontSize: 11, fontWeight: 800 }}>1 of 4</div>
            {/* confidence meter */}
            <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,0.35)", overflow: "hidden" }}>
                <div style={{ width: "61%", height: "100%", background: AMBER, borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>61% match</span>
            </div>
          </div>
          <div style={{ padding: "14px 18px 18px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: AMBER, marginBottom: 8 }}>Best guess — confirm which</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {guesses.map((g) => (
                <span key={g.n} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 11, fontSize: 13.5, fontWeight: 800, background: g.on ? P.ink : P.canvas, color: g.on ? "#fff" : P.inkSoft, border: "1.5px solid " + (g.on ? P.ink : P.border) }}>
                  {g.on && <I.Check size={13} color="#fff" strokeWidth={3} />}{g.n}
                </span>
              ))}
            </div>
            {/* smart defaults still inherited from the capture context */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {chip("MapPin", "Office · Desk", true)}
              {chip("Tag", "Tech")}
            </div>
          </div>
        </div>

        {/* triage actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 22 }}>
          <div style={{ width: 56, height: 56, borderRadius: 99, background: P.surface, border: "1.5px solid " + P.border, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: P.shadowSoft }}>
            <I.X size={22} color={P.warm} strokeWidth={2.4} />
          </div>
          <div style={{ flex: 1, maxWidth: 168, height: 56, borderRadius: 99, background: P.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15, fontWeight: 800, boxShadow: "0 10px 22px " + P.accent + "55", whiteSpace: "nowrap" }}>
            <I.Check size={19} color="#fff" strokeWidth={2.6} /> Confirm &amp; add
          </div>
          <div style={{ width: 56, height: 56, borderRadius: 99, background: P.surface, border: "1.5px solid " + P.border, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: P.shadowSoft }}>
            <I.Edit size={20} color={P.inkSoft} />
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 13, fontSize: 11.5, fontWeight: 600, color: P.warm }}>Pick the right name, then swipe right to add · left to skip</div>
      </div>
    </Screen>
  );
}

/* ============================ C3 — batch confirmation + undo ============================ */
function C3_Done() {
  const I = window.StowIcons;
  const added = [
    { n: "Mechanical Keyboard", img: IMG.keyboard, v: "$140" },
    { n: "Sony WH-1000XM5", img: IMG.headphones, v: "$250" },
    { n: "Apple Watch", img: IMG.watch, v: "$400" },
  ];
  return (
    <Screen>
      <StatusBar />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "12px 24px 0" }}>
        {/* hero confirmation */}
        <div style={{ textAlign: "center", marginTop: 14, marginBottom: 22 }}>
          <div style={{ width: 64, height: 64, borderRadius: 99, background: P.successSoft || "#EAFAF2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <I.Check size={32} color={P.success} strokeWidth={2.6} />
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: P.ink, letterSpacing: -0.4 }}>3 items filed</h1>
          <div style={{ display: "inline-flex", marginTop: 2 }}><Bread room="Office" area="Desk" color={LR} /></div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {added.map((it) => (
            <div key={it.n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14, background: P.surface, border: "1px solid " + P.borderL, boxShadow: P.shadowSoft }}>
              <img src={it.img} alt="" style={{ width: 44, height: 44, borderRadius: 11, objectFit: "cover", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.n}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: P.warm, marginTop: 1 }}>{it.v}</div>
              </div>
              <div style={{ width: 22, height: 22, borderRadius: 99, background: P.successSoft || "#EAFAF2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <I.Check size={13} color={P.success} strokeWidth={3} />
              </div>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", fontSize: 12.5, fontWeight: 600, color: P.warm }}>
            <I.X size={14} color={P.warm} /> 1 skipped (couldn't identify) · not added
          </div>
        </div>
      </div>

      {/* reversible close */}
      <div style={{ padding: "12px 24px 28px", flexShrink: 0, display: "flex", gap: 10 }}>
        <div style={{ width: 56, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 15, background: P.canvas, border: "1.5px solid " + P.border }}>
          <I.ArrowRight size={18} color={P.inkSoft} style={{ transform: "scaleX(-1)" }} />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "15px 0", borderRadius: 15, background: P.ink, color: "#fff", fontSize: 15, fontWeight: 800 }}>Done</div>
      </div>
    </Screen>
  );
}

Object.assign(window, { EX_CAP: { C1_Detect, C2_Review, C3_Done } });
