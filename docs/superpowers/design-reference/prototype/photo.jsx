/* Stow — real photo capture. Replaces the URL-paste field with the genuine
   mobile flow: camera, library, and AI scan. Exported to window.StowScreens. */
(function () {
  const { useState } = React;

  /* viewfinder corner brackets */
  function CornerBrackets({ color }) {
    return [0, 1, 2, 3].map((k) => {
      const pos = [{ top: 0, left: 0 }, { top: 0, right: 0 }, { bottom: 0, left: 0 }, { bottom: 0, right: 0 }][k];
      const br = ["18px 0 0 0", "0 18px 0 0", "0 0 0 18px", "0 0 18px 0"][k];
      return <div key={k} style={{ position: "absolute", width: 40, height: 40, border: "3px solid " + color, borderRadius: br, ...pos, ...(k < 2 ? { borderBottom: "none" } : { borderTop: "none" }), ...(k % 2 === 0 ? { borderRight: "none" } : { borderLeft: "none" }) }} />;
    });
  }

  function SourceTile({ P, icon: Ic, label, sub, onClick }) {
    return (
      <button onClick={onClick} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 8px", borderRadius: P.radius + 6, border: "1.5px solid " + P.border, background: P.canvas, cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: P.accent + "16", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Ic size={22} color={P.accent} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: P.ink }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: P.warm }}>{sub}</div>
      </button>
    );
  }

  /* Inline field used in the Add Item sheet and Edit Item form. */
  function PhotoField({ P, I, value, target, act }) {
    if (value) {
      const ctrl = (onClick, Ic, txt, danger) => (
        <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: txt ? "9px 14px" : "9px 11px", borderRadius: 99, border: "none", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <Ic size={14} color={danger ? "#FF6B6B" : "#fff"} />{txt ? " " + txt : ""}
        </button>
      );
      return (
        <div style={{ position: "relative", borderRadius: P.radius + 6, overflow: "hidden", height: 170, border: "1px solid " + P.borderL }}>
          <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 70, background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" }} />
          <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", gap: 8 }}>
            {ctrl(() => act.openPhoto(target, "camera", false), I.Camera, "Retake")}
            {ctrl(() => act.openPhoto(target, "library", false), I.ImageIcon, "Replace")}
            <div style={{ flex: 1 }} />
            {ctrl(() => act.removePhoto(target), I.Trash2, "", true)}
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <SourceTile P={P} icon={I.Camera} label="Take Photo" sub="Use camera" onClick={() => act.openPhoto(target, "camera", false)} />
          <SourceTile P={P} icon={I.ImageIcon} label="Library" sub="Choose photo" onClick={() => act.openPhoto(target, "library", false)} />
        </div>
        <button onClick={() => act.openPhoto(target, "camera", true)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: P.radius + 6, border: "1.5px solid " + P.accent + "44", background: P.accent + "10", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: P.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I.Sparkles size={17} color="#fff" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: P.ink }}>Scan with AI</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: P.warm }}>Auto-fill name, value &amp; tags from a photo</div>
          </div>
          <I.ChevronRight size={16} color={P.accent} />
        </button>
      </div>
    );
  }

  /* Full-screen capture overlay: camera viewfinder OR library grid. */
  function PhotoSource({ c }) {
    const { P, I, photo, act } = c;
    const [phase, setPhase] = useState("live"); // live | flash | captured | identifying
    const [shot, setShot] = useState(null);
    if (!photo) return null;
    const D = window.StowData;

    /* ── Library grid ── */
    if (photo.mode === "library") {
      return (
        <div style={{ position: "absolute", inset: 0, zIndex: 85, background: P.surface, display: "flex", flexDirection: "column", animation: "stowUp 0.28s ease-out" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 18px 14px", borderBottom: "1px solid " + P.borderL }}>
            <button onClick={act.closePhoto} style={{ fontSize: 15, fontWeight: 700, color: P.accent, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <div style={{ fontSize: 16, fontWeight: 800, color: P.ink }}>Recents</div>
            <button onClick={() => act.openPhoto(photo.target, "camera", photo.ai)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><I.Camera size={20} color={P.accent} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 3 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
              {D.PHOTO_POOL.map((url, i) => (
                <button key={i} onClick={() => { setShot(url); setTimeout(() => act.applyPhoto(url, null), 220); }} style={{ position: "relative", aspectRatio: "1 / 1", border: "none", padding: 0, cursor: "pointer", background: P.canvas, overflow: "hidden" }}>
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: shot === url ? 0.55 : 1 }} />
                  {shot === url && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: P.accent + "33" }}>
                      <div style={{ width: 30, height: 30, borderRadius: 99, background: P.accent, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Check size={16} color="#fff" /></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    /* ── Camera ── */
    const captured = phase === "captured" || phase === "identifying";
    const capture = () => { setShot(D.PHOTO_POOL[0]); setPhase("flash"); setTimeout(() => setPhase("captured"), 170); };
    const usePhoto = () => {
      if (photo.ai) {
        setPhase("identifying");
        setTimeout(() => act.applyPhoto(shot, { name: "Sony WH-1000XM5", value: "250", tags: "Tech, Audio" }), 1500);
      } else {
        act.applyPhoto(shot, null);
      }
    };
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 85, background: "#0A0A12", display: "flex", flexDirection: "column", animation: "stowUp 0.28s ease-out" }}>
        {/* top bar */}
        <div style={{ position: "absolute", top: 52, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", zIndex: 5 }}>
          <button onClick={act.closePhoto} style={{ width: 40, height: 40, borderRadius: 99, background: "rgba(255,255,255,0.15)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}><I.X size={18} color="#fff" /></button>
          {photo.ai
            ? <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 13, fontWeight: 700, background: "rgba(255,255,255,0.12)", padding: "8px 14px", borderRadius: 99 }}><I.Sparkles size={14} color={P.accent} /> AI Scan</div>
            : <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>New Photo</div>}
          <div style={{ width: 40 }} />
        </div>

        {/* viewfinder / captured frame */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <img src={captured ? shot : D.CAMERA_FEED} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: captured ? "none" : "saturate(1.05)" }} />
          {!captured && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 42%, transparent 38%, rgba(0,0,0,0.5) 100%)" }} />}
          {!captured && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 244, height: 244 }}><CornerBrackets color={photo.ai ? P.accent : "rgba(255,255,255,0.85)"} /></div>}
          {phase === "identifying" && (
            <React.Fragment>
              <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,18,0.35)" }} />
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 244, height: 244, borderRadius: 20 }}>
                <CornerBrackets color={P.accent} />
                <div style={{ position: "absolute", left: 8, right: 8, height: 3, borderRadius: 99, background: P.accent, boxShadow: "0 0 16px " + P.accent, animation: "stowScan 1.4s ease-in-out infinite" }} />
              </div>
            </React.Fragment>
          )}
          {phase === "flash" && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.85 }} />}
        </div>

        {/* bottom controls */}
        <div style={{ position: "relative", padding: "18px 24px 54px", zIndex: 5 }}>
          {phase === "identifying" ? (
            <div style={{ textAlign: "center", color: "#fff" }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Identifying item…</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Naming, valuing &amp; tagging</div>
            </div>
          ) : captured ? (
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => { setShot(null); setPhase("live"); }} style={{ flex: 1, padding: "15px 0", borderRadius: 16, border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Retake</button>
              <button onClick={usePhoto} style={{ flex: 1, padding: "15px 0", borderRadius: 16, border: "none", background: P.accent, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {photo.ai
                  ? <React.Fragment><I.Sparkles size={16} color="#fff" /> Use &amp; Identify</React.Fragment>
                  : <React.Fragment><I.Check size={16} color="#fff" /> Use Photo</React.Fragment>}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={() => act.openPhoto(photo.target, "library", photo.ai)} style={{ width: 46, height: 46, borderRadius: 12, overflow: "hidden", border: "2px solid rgba(255,255,255,0.5)", padding: 0, cursor: "pointer", background: "none" }}>
                <img src={D.PHOTO_POOL[1]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
              <button onClick={capture} style={{ width: 74, height: 74, borderRadius: 99, border: "5px solid rgba(255,255,255,0.35)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 54, height: 54, borderRadius: 99, background: photo.ai ? P.accent : "#fff", border: photo.ai ? "none" : "2px solid #0A0A12" }} />
              </button>
              <div style={{ width: 46, height: 46, borderRadius: 99, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><I.Grid size={20} color="rgba(255,255,255,0.7)" /></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────────────
     CAMERA-FIRST add flow. The whole "Add Item" action opens here first:
     photo capture is the entry point, not a field. Capture / pick / AI-scan,
     then the details sheet slides up with the photo already attached. */
  function CaptureFirst({ c }) {
    const { P, I, addCapture, act } = c;
    const [mode, setMode] = useState(addCapture && addCapture.mode === "ai" ? "ai" : "photo");
    const [phase, setPhase] = useState("live"); // live | flash | captured | identifying
    const [shot, setShot] = useState(null);
    const [lib, setLib] = useState(false);
    if (!addCapture) return null;
    const D = window.StowData;
    const ai = mode === "ai";
    const captured = phase === "captured" || phase === "identifying";

    const capture = () => { setShot(D.PHOTO_POOL[0]); setPhase("flash"); setTimeout(() => setPhase("captured"), 170); };
    const proceed = () => {
      if (ai) {
        setPhase("identifying");
        setTimeout(() => act.captureResult(shot, { name: "Sony WH-1000XM5", value: "250", tags: "Tech, Audio" }), 1500);
      } else {
        act.captureResult(shot, null);
      }
    };

    /* ── library picker (inline) ── */
    if (lib) {
      return (
        <div style={{ position: "absolute", inset: 0, zIndex: 86, background: P.surface, display: "flex", flexDirection: "column", animation: "stowUp 0.28s ease-out" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "54px 18px 14px", borderBottom: "1px solid " + P.borderL }}>
            <button onClick={() => setLib(false)} style={{ fontSize: 15, fontWeight: 700, color: P.accent, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Camera</button>
            <div style={{ fontSize: 16, fontWeight: 800, color: P.ink }}>Recents</div>
            <div style={{ width: 54 }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 3 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
              {D.PHOTO_POOL.map((url, i) => (
                <button key={i} onClick={() => { setShot(url); setTimeout(() => { setLib(false); setPhase("captured"); }, 200); }} style={{ position: "relative", aspectRatio: "1 / 1", border: "none", padding: 0, cursor: "pointer", background: P.canvas, overflow: "hidden" }}>
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: shot === url ? 0.55 : 1 }} />
                  {shot === url && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: P.accent + "33" }}>
                      <div style={{ width: 30, height: 30, borderRadius: 99, background: P.accent, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Check size={16} color="#fff" /></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 85, background: "#0A0A12", display: "flex", flexDirection: "column", animation: "stowUp 0.3s ease-out" }}>
        {/* top bar */}
        <div style={{ position: "absolute", top: 52, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 18px", zIndex: 6 }}>
          <button onClick={act.closeAddCapture} style={{ width: 40, height: 40, borderRadius: 99, background: "rgba(255,255,255,0.15)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}><I.X size={18} color="#fff" /></button>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: -0.2 }}>New Item</div>
          {!captured
            ? <button onClick={act.skipCapture} style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.85)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "8px 4px" }}>Skip</button>
            : <div style={{ width: 40 }} />}
        </div>

        {/* viewfinder / frozen frame */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <img src={captured ? shot : D.CAMERA_FEED} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: captured ? "none" : "saturate(1.05)" }} />
          {!captured && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 44%, transparent 36%, rgba(0,0,0,0.55) 100%)" }} />}
          {!captured && (
            <React.Fragment>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 244, height: 244 }}><CornerBrackets color={ai ? P.accent : "rgba(255,255,255,0.85)"} /></div>
              <div style={{ position: "absolute", top: "calc(50% + 142px)", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: 600 }}>
                {ai ? "Frame the item — Stow will name, value & tag it" : "Center your item in the frame"}
              </div>
            </React.Fragment>
          )}
          {phase === "identifying" && (
            <React.Fragment>
              <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,18,0.4)" }} />
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 244, height: 244, borderRadius: 20 }}>
                <CornerBrackets color={P.accent} />
                <div style={{ position: "absolute", left: 8, right: 8, height: 3, borderRadius: 99, background: P.accent, boxShadow: "0 0 16px " + P.accent, animation: "stowScan 1.4s ease-in-out infinite" }} />
              </div>
            </React.Fragment>
          )}
          {phase === "flash" && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.85 }} />}
        </div>

        {/* bottom controls */}
        <div style={{ position: "relative", padding: "16px 24px 50px", zIndex: 5 }}>
          {phase === "identifying" ? (
            <div style={{ textAlign: "center", color: "#fff" }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Identifying item…</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Naming, valuing &amp; tagging</div>
            </div>
          ) : captured ? (
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => { setShot(null); setPhase("live"); }} style={{ flex: 1, padding: "15px 0", borderRadius: 16, border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Retake</button>
              <button onClick={proceed} style={{ flex: 1.4, padding: "15px 0", borderRadius: 16, border: "none", background: P.accent, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {ai
                  ? <React.Fragment><I.Sparkles size={16} color="#fff" /> Use &amp; Identify</React.Fragment>
                  : <React.Fragment><I.ArrowRight size={16} color="#fff" /> Use Photo</React.Fragment>}
              </button>
            </div>
          ) : (
            <React.Fragment>
              {/* mode strip */}
              <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, padding: 4, width: "fit-content", margin: "0 auto 20px" }}>
                {[["photo", "Photo", I.Camera], ["ai", "AI Scan", I.Sparkles]].map(([k, label, Ic]) => {
                  const on = mode === k;
                  return (
                    <button key={k} onClick={() => setMode(k)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 99, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, color: on ? "#fff" : "rgba(255,255,255,0.6)", background: on ? (k === "ai" ? P.accent : "rgba(255,255,255,0.22)") : "transparent" }}>
                      <Ic size={14} color={on ? "#fff" : "rgba(255,255,255,0.6)"} /> {label}
                    </button>
                  );
                })}
              </div>
              {/* capture row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button onClick={() => setLib(true)} style={{ width: 46, height: 46, borderRadius: 12, overflow: "hidden", border: "2px solid rgba(255,255,255,0.5)", padding: 0, cursor: "pointer", background: "none" }}>
                  <img src={D.PHOTO_POOL[1]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
                <button onClick={capture} style={{ width: 74, height: 74, borderRadius: 99, border: "5px solid rgba(255,255,255,0.35)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 54, height: 54, borderRadius: 99, background: ai ? P.accent : "#fff", border: ai ? "none" : "2px solid #0A0A12" }} />
                </button>
                <div style={{ width: 46, height: 46, borderRadius: 99, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><I.Camera size={20} color="rgba(255,255,255,0.7)" /></div>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>
    );
  }

  window.StowScreens = window.StowScreens || {};
  Object.assign(window.StowScreens, { PhotoField, PhotoSource, CaptureFirst });
})();
