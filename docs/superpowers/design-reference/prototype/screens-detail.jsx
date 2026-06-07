/* Stow detail screens: ItemDetail, Packing, Settings, ScanOverlay. Exported to window.StowScreens. */
const { useState: useStateD } = React;

function ItemDetail({ c }) {
  const { P, I, U, items, rooms, itemId, editing, edit, act, t } = c;
  const item = items.find((i) => i.id === itemId);
  const roomName = (rid) => { const r = rooms.find((x) => x.id === rid); return r ? r.name : ""; };
  const locFirst = t.itemPriority === "location";
  const allTags = Array.from(new Set(items.flatMap((i) => i.tags || [])));
  const [tagPicker, setTagPicker] = useStateD(false);
  const [newTag, setNewTag] = useStateD("");
  if (!item) return null;
  const hasImg = editing ? edit.image : item.image;
  const imgSrc = editing ? edit.image : item.image;

  const iconBtn = (onClick, child) => (
    <button onClick={onClick} style={{ width: 40, height: 40, borderRadius: 99, background: hasImg ? "rgba(255,255,255,0.22)" : P.canvas, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>{child}</button>
  );

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, background: P.surface, display: "flex", flexDirection: "column", animation: "stowUp 0.32s ease-out" }}>
      <div style={{ position: "relative", height: hasImg ? "38%" : "18%", background: P.canvas, flexShrink: 0 }}>
        {hasImg ? <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {item.isFolder ? <I.Folder size={48} color={P.border} strokeWidth={1} /> : <I.Inbox size={48} color={P.border} strokeWidth={1} />}
          </div>
        )}
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", padding: "52px 16px 0", display: "flex", justifyContent: "space-between", zIndex: 10, background: hasImg ? "linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)" : "transparent" }}>
          {iconBtn(() => { act.closeItem(); setTagPicker(false); }, <I.ChevronLeft size={18} strokeWidth={2.5} color={hasImg ? "#fff" : P.ink} />)}
          {!editing && !tagPicker && (
            <div style={{ display: "flex", gap: 8 }}>
              {iconBtn(act.startEdit, <I.Edit size={16} color={hasImg ? "#fff" : P.accent} />)}
              {iconBtn(() => act.askDelete(item.id), <I.Trash2 size={16} color={hasImg ? "#fff" : P.danger} />)}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, marginTop: -24, borderRadius: "28px 28px 0 0", position: "relative", zIndex: 10, padding: 24, background: P.surface, boxShadow: "0 -8px 30px rgba(0,0,0,0.1)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {tagPicker ? (
          <div>
            <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: P.ink }}>Manage Tags</h2>
            <U.FieldLabel P={P}>Assigned</U.FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {(item.tags || []).map((t) => (
                <button key={t} onClick={() => act.toggleItemTag(t)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: P.accent, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  <I.Tag size={11} color="#fff" /> {t} <I.X size={11} color="#fff" style={{ opacity: 0.8 }} />
                </button>
              ))}
              {(item.tags || []).length === 0 && <span style={{ fontSize: 13, color: P.warm }}>None yet</span>}
            </div>
            <U.FieldLabel P={P}>Available</U.FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {allTags.filter((t) => !(item.tags || []).includes(t)).map((t) => (
                <button key={t} onClick={() => act.toggleItemTag(t)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: P.canvas, color: P.inkSoft, border: "1px solid " + P.borderL, cursor: "pointer", fontFamily: "inherit" }}>
                  <I.Tag size={11} color={P.inkMuted} /> {t} <I.Plus size={11} color={P.warm} />
                </button>
              ))}
            </div>
            <U.FieldLabel P={P}>Create New</U.FieldLabel>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newTag.trim()) { act.toggleItemTag(newTag.trim()); setNewTag(""); } }} placeholder="New tag..."
                style={{ flex: 1, boxSizing: "border-box", borderRadius: P.radius + 2, padding: "10px 16px", fontSize: 14, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit" }} />
              <button onClick={() => { if (newTag.trim()) { act.toggleItemTag(newTag.trim()); setNewTag(""); } }} style={{ padding: "10px 18px", borderRadius: P.radius + 2, fontSize: 13, fontWeight: 700, border: "none", background: newTag.trim() ? P.accent : P.border, color: newTag.trim() ? "#fff" : P.warm, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Create</button>
            </div>
            <U.Button P={P} bg={P.ink} color={P.surface} onClick={() => setTagPicker(false)}>Done</U.Button>
          </div>
        ) : editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: P.ink }}>Edit Item</h2>
              <button onClick={act.cancelEdit} style={{ fontSize: 14, fontWeight: 700, color: P.warm, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
            <div><U.FieldLabel P={P}>Name</U.FieldLabel><U.Input P={P} value={edit.name} onChange={(e) => act.setEdit("name", e.target.value)} placeholder="Item name" /></div>
            <div><U.FieldLabel P={P}>Photo</U.FieldLabel><window.StowScreens.PhotoField P={P} I={I} value={edit.image} target="edit" act={act} /></div>
            <div><U.FieldLabel P={P}>Value ($)</U.FieldLabel><U.Input P={P} value={edit.value} onChange={(e) => act.setEdit("value", e.target.value)} placeholder="0" type="number" /></div>
            <div>
              <U.FieldLabel P={P}>Notes</U.FieldLabel>
              <textarea value={edit.notes} onChange={(e) => act.setEdit("notes", e.target.value)} placeholder="Serial number, purchase info..." rows={3}
                style={{ width: "100%", boxSizing: "border-box", borderRadius: P.radius + 2, padding: "12px 16px", fontSize: 15, fontWeight: 500, outline: "none", border: "1.5px solid " + P.border, background: P.canvas, color: P.ink, fontFamily: "inherit", resize: "none" }} />
            </div>
            <U.Button P={P} bg={edit.name.trim() ? P.accent : P.border} color="#fff" onClick={act.saveEdit}><I.Save size={16} color="#fff" /> Save Changes</U.Button>
          </div>
        ) : (
          <React.Fragment>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: locFirst ? 14 : 20 }}>
              <div style={{ flex: 1, marginRight: 12 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: P.ink, letterSpacing: -0.3 }}>{item.name}</h1>
                {/* price-forward: prominent price right under the name */}
                {!locFirst && (item.value || item.isPriceless) ? (
                  <div style={{ fontSize: 14, fontWeight: 600, color: P.warm, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    {item.isPriceless ? <React.Fragment><I.Star size={13} color={P.accent} /> Priceless</React.Fragment> : "$" + item.value}
                  </div>
                ) : null}
              </div>
              <button onClick={() => { act.togglePack(item.id); act.flash(item.isPacked ? "Removed from bag" : "Added to bag"); }}
                style={{ width: 48, height: 48, borderRadius: 16, border: item.isPacked ? "none" : "1.5px solid " + P.border, background: item.isPacked ? P.success : P.canvas, color: item.isPacked ? "#fff" : P.warm, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <I.Package size={20} strokeWidth={2} color={item.isPacked ? "#fff" : P.warm} />
              </button>
            </div>
            {locFirst ? (
              <React.Fragment>
                {/* LOCATION as hero — tappable to move */}
                <button onClick={() => act.flash("Pick a destination space")}
                  style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 13, borderRadius: 18, padding: "14px 16px", marginBottom: 12, cursor: "pointer", background: P.accentSoft, border: "1px solid " + P.accent + "26", fontFamily: "inherit" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: P.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <I.MapPin size={21} color="#fff" strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: P.accent, marginBottom: 3 }}>Location</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 17, fontWeight: 800, color: P.ink, letterSpacing: -0.2 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{roomName(item.roomId)}</span>
                      <I.ChevronRight size={14} color={P.warm} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                      <span style={{ color: P.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.area}</span>
                    </div>
                  </div>
                  <I.ArrowRight size={16} color={P.accent} style={{ flexShrink: 0, opacity: 0.6 }} />
                </button>
                {/* price demoted to a quiet secondary line */}
                {(item.value || item.isPriceless) ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 18, marginLeft: 2, fontSize: 12.5, fontWeight: 600, color: P.warm }}>
                    {item.isPriceless
                      ? <React.Fragment><I.Star size={12} color={P.warm} /> Priceless</React.Fragment>
                      : <React.Fragment><span style={{ textTransform: "uppercase", letterSpacing: 0.8, fontSize: 10.5, fontWeight: 800 }}>Value</span> ${item.value}</React.Fragment>}
                  </div>
                ) : null}
              </React.Fragment>
            ) : (
              <div style={{ borderRadius: 16, padding: 16, marginBottom: 14, background: P.canvas, border: "1px solid " + P.borderL }}>
                <U.FieldLabel P={P}>Location</U.FieldLabel>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: P.ink }}>
                  <I.MapPin size={15} color={P.accent} /><span>{roomName(item.roomId)}</span><I.ChevronRight size={12} color={P.border} /><span style={{ color: P.inkMuted }}>{item.area}</span>
                </div>
              </div>
            )}
            {item.notes ? (
              <div style={{ borderRadius: 16, padding: 16, marginBottom: 14, background: P.canvas, border: "1px solid " + P.borderL }}>
                <U.FieldLabel P={P}>Notes</U.FieldLabel>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: P.inkSoft }}>{item.notes}</p>
              </div>
            ) : null}
            <div style={{ marginBottom: 20 }}>
              <U.FieldLabel P={P}>Tags</U.FieldLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(item.tags || []).map((t) => (
                  <span key={t} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 700, background: P.canvas, color: P.inkSoft, border: "1px solid " + P.borderL }}><I.Tag size={11} color={P.inkMuted} /> {t}</span>
                ))}
                <span onClick={() => setTagPicker(true)} style={{ padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 700, color: P.accent, border: "1.5px dashed " + P.accent + "55", background: P.accentSoft, cursor: "pointer" }}>+ Add</span>
              </div>
            </div>
            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              <U.Button P={P} bg={P.accentSoft} color={P.accent} onClick={act.startEdit} style={{ border: "1px solid " + P.accent + "26" }}><I.Edit size={15} color={P.accent} /> Edit Item</U.Button>
              <U.Button P={P} bg={P.canvas} color={P.ink} onClick={() => act.flash("Pick a destination space")} style={{ border: "1px solid " + P.border }}><I.ArrowRight size={15} color={P.ink} /> Move to another space</U.Button>
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

function PackingScreen({ c }) {
  const { P, I, U, items, packingLists, activeListId, act } = c;
  const list = packingLists.find((l) => l.id === activeListId);

  if (!list) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas }}>
        <div style={{ padding: "56px 24px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: P.ink, fontFamily: "var(--stow-display)" }}>Packing</h1>
            <button onClick={() => act.flash("New list created")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700, border: "none", background: P.accent, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
              <I.Plus size={15} color="#fff" /> New List
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 150px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {packingLists.map((l) => {
              const total = l.itemIds.length;
              const done = l.packedItemIds.length;
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <div key={l.id} onClick={() => act.openList(l.id)} style={{ ...U.cardStyle(P), padding: 18, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: P.ink }}>{l.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: P.warm, marginTop: 2 }}>{done} of {total} packed</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? P.success : P.accent }}>{pct}%</div>
                  </div>
                  <div style={{ marginTop: 14, height: 7, borderRadius: 99, background: P.borderL, overflow: "hidden" }}>
                    <div style={{ width: pct + "%", height: "100%", borderRadius: 99, background: pct === 100 ? P.success : P.accent, transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })}
            <div onClick={() => act.flash("New list created")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 0", borderRadius: P.radius + 4, border: "2px dashed " + P.border, color: P.warm, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              <I.Plus size={16} strokeWidth={2.5} color={P.warm} /> New Packing List
            </div>
          </div>
        </div>
      </div>
    );
  }

  const listItems = list.itemIds.map((id) => items.find((i) => i.id === id)).filter(Boolean);
  const done = list.packedItemIds.length;
  const total = list.itemIds.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas }}>
      <div style={{ padding: "56px 16px 14px", background: P.surface + "E6", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid " + P.borderL, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={act.backToLists} style={{ display: "flex", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: P.accent, fontWeight: 700, fontSize: 15, padding: "4px", fontFamily: "inherit" }}>
            <I.ChevronLeft size={20} strokeWidth={2.5} color={P.accent} /> Lists
          </button>
          <button onClick={() => act.clearList(list.id)} style={{ fontSize: 13, fontWeight: 700, color: P.warm, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Clear all</button>
        </div>
        <h1 style={{ margin: "8px 4px 10px", fontSize: 24, fontWeight: 900, color: P.ink }}>{list.name}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
          <div style={{ flex: 1, height: 8, borderRadius: 99, background: P.borderL, overflow: "hidden" }}>
            <div style={{ width: pct + "%", height: "100%", borderRadius: 99, background: pct === 100 ? P.success : P.accent, transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? P.success : P.inkMuted, whiteSpace: "nowrap" }}>{done}/{total}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 150px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listItems.map((it) => {
            const packed = list.packedItemIds.includes(it.id);
            return (
              <div key={it.id} style={{ ...U.cardStyle(P), borderRadius: P.radius + 4, padding: 12, display: "flex", alignItems: "center", gap: 14, opacity: packed ? 0.6 : 1 }}>
                <button onClick={() => act.toggleListItem(list.id, it.id)} style={{ width: 26, height: 26, borderRadius: 99, flexShrink: 0, border: packed ? "none" : "2px solid " + P.border, background: packed ? P.success : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {packed && <I.Check size={14} color="#fff" strokeWidth={3} />}
                </button>
                <div onClick={() => act.openItem(it.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  {it.image ? <img src={it.image} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} /> : <div style={{ width: 40, height: 40, borderRadius: 10, background: P.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Inbox size={16} color={P.warm} /></div>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: P.ink, textDecoration: packed ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: P.warm }}>{it.area}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div onClick={() => act.flash("Pick items to add")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "18px 0", marginTop: 12, borderRadius: P.radius + 4, border: "2px dashed " + P.border, color: P.warm, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          <I.Plus size={16} strokeWidth={2.5} color={P.warm} /> Add Items
        </div>
      </div>
    </div>
  );
}

function SettingsScreen({ c }) {
  const { P, I, U, members, act, tweaks } = c;
  const row = (label, value, danger) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid " + P.borderL }}>
      <span style={{ fontSize: 15, fontWeight: 600, color: danger ? P.danger : P.ink }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: P.warm }}>
        {value && <span style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>}
        <I.ChevronRight size={15} color={P.border} />
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: P.canvas }}>
      <div style={{ padding: "56px 24px 8px" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: P.ink, fontFamily: "var(--stow-display)" }}>Settings</h1>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 150px" }}>
        {/* household */}
        <div style={{ ...U.cardStyle(P), padding: 18, marginBottom: 22, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: P.accent + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I.Home size={22} color={P.accent} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: P.ink }}>The Park-Rivera Home</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: P.warm, marginTop: 1 }}>{members.length} members · Pro plan</div>
          </div>
        </div>

        <U.Label P={P}>Members</U.Label>
        <div style={{ ...U.cardStyle(P), overflow: "hidden", marginBottom: 22 }}>
          {members.map((m, idx) => (
            <div key={m.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: idx < members.length - 1 ? "1px solid " + P.borderL : "none" }}>
              <div style={{ width: 38, height: 38, borderRadius: 99, background: P.accent + "22", color: P.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{m.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{m.name}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: P.warm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
              </div>
              <U.RoleBadge P={P} role={m.role} />
            </div>
          ))}
          <div onClick={() => act.flash("Invite link copied")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 15, cursor: "pointer", color: P.accent, fontWeight: 700, fontSize: 14, borderTop: "1px solid " + P.borderL }}>
            <I.Users size={16} color={P.accent} /> Invite Member
          </div>
        </div>

        <U.Label P={P}>AI Vision</U.Label>
        <div style={{ ...U.cardStyle(P), padding: 18, marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: P.accent + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><I.Sparkles size={18} color={P.accent} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>Scan & Categorize</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: P.success }}>Connected · Claude</div>
            </div>
            <div style={{ width: 44, height: 26, borderRadius: 99, background: P.success, position: "relative", padding: 3, boxSizing: "border-box" }}>
              <div style={{ width: 20, height: 20, borderRadius: 99, background: "#fff", position: "absolute", right: 3, top: 3 }} />
            </div>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: P.inkMuted }}>Point your camera at an item and Stow names it, estimates value, and suggests tags automatically.</div>
        </div>

        <U.Label P={P}>Preferences</U.Label>
        <div style={{ ...U.cardStyle(P), overflow: "hidden", marginBottom: 22 }}>
          {row("Offline mode", "On")}
          {row("Default space", "Living Room")}
          {row("Export inventory (CSV)", "")}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: P.danger }}>Sign out</span>
            <I.ChevronRight size={15} color={P.border} />
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: P.warm }}>Stow v3.1 · Synced just now</div>
      </div>
    </div>
  );
}

function ScanOverlay({ c }) {
  const { P, I, scanning, act } = c;
  const [mode, setMode] = useStateD("single"); // single | shelf
  const shelf = mode === "shelf";
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 75, background: "#0A0A12", display: "flex", flexDirection: "column", animation: "stowUp 0.3s ease-out" }}>
      <div style={{ position: "absolute", top: 52, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", zIndex: 3 }}>
        <button onClick={act.closeScan} style={{ width: 40, height: 40, borderRadius: 99, background: "rgba(255,255,255,0.15)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(10px)" }}><I.X size={18} color="#fff" /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 13, fontWeight: 700, background: "rgba(255,255,255,0.12)", padding: "8px 14px", borderRadius: 99 }}><I.Sparkles size={14} color={P.accent} /> AI Scan</div>
        <div style={{ width: 40 }} />
      </div>

      {/* viewfinder */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%, rgba(40,40,60,0.6), #0A0A12 70%)" }} />
        <div style={{ position: "relative", width: 250, height: 250, borderRadius: 28 }}>
          {[0, 1, 2, 3].map((k) => {
            const pos = [{ top: 0, left: 0 }, { top: 0, right: 0 }, { bottom: 0, left: 0 }, { bottom: 0, right: 0 }][k];
            const br = ["20px 0 0 0", "0 20px 0 0", "0 0 0 20px", "0 0 20px 0"][k];
            return <div key={k} style={{ position: "absolute", width: 44, height: 44, border: "3px solid " + P.accent, borderRadius: br, ...pos, ...(k < 2 ? { borderBottom: "none" } : { borderTop: "none" }), ...(k % 2 === 0 ? { borderRight: "none" } : { borderLeft: "none" }) }} />;
          })}
          {scanning && <div style={{ position: "absolute", left: 8, right: 8, height: 3, borderRadius: 99, background: P.accent, boxShadow: "0 0 16px " + P.accent, animation: "stowScan 1.4s ease-in-out infinite" }} />}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I.ScanLine size={40} color="rgba(255,255,255,0.25)" />
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 60px", textAlign: "center", position: "relative", zIndex: 3 }}>
        <div style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{scanning ? "Identifying item…" : shelf ? "Frame a whole shelf" : "Point at an item"}</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 22 }}>{scanning ? "Stow is naming, valuing & tagging it" : shelf ? "Capture once — Stow finds every item in the shot" : "Stow will name, value and tag it for you"}</div>

        {/* mode strip — one item vs the whole shot */}
        {!scanning && (
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, padding: 4, width: "fit-content", margin: "0 auto 22px" }}>
            {[["single", "One item", I.ScanLine], ["shelf", "Whole shelf", I.Grid]].map(([k, label, Ic]) => {
              const on = mode === k;
              return (
                <button key={k} onClick={() => setMode(k)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 99, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, color: on ? "#fff" : "rgba(255,255,255,0.6)", background: on ? P.accent : "transparent" }}>
                  <Ic size={14} color={on ? "#fff" : "rgba(255,255,255,0.6)"} /> {label}
                </button>
              );
            })}
          </div>
        )}

        <button onClick={shelf ? act.startQuickCapture : act.doScan} disabled={scanning}
          style={{ width: 76, height: 76, borderRadius: 99, margin: "0 auto", border: "5px solid rgba(255,255,255,0.3)", background: scanning ? P.warm : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: scanning ? "default" : "pointer" }}>
          {shelf && !scanning
            ? <div style={{ width: 54, height: 54, borderRadius: 18, background: P.accent, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Grid size={24} color="#fff" /></div>
            : <div style={{ width: 54, height: 54, borderRadius: 99, background: scanning ? P.warm : P.accent }} />}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  StowScreens: Object.assign(window.StowScreens || {}, { ItemDetail, PackingScreen, SettingsScreen, ScanOverlay }),
});
