import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Item, PackingList, SpaceWithAreas } from "@/types/domain";
import { Check, ChevronLeft, Inbox, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { ProgressBar } from "@/features/stow/ui/mobile/components/ProgressBar";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";
import { ActionSheet } from "@/features/stow/ui/mobile/shell/ActionSheet";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { matchesPackingItemPickerQuery } from "@/features/stow/ui/mobile/screens/pickerSearch";

export interface PackingScreenProps {
  packingLists: PackingList[];
  items: Item[];
  spaces: SpaceWithAreas[];
  onOpenItem: (itemId: string) => void;
  onCreateList: (name: string) => void;
  onRenameList: (listId: string, name: string) => void;
  onDeleteList: (listId: string) => void;
  onToggleItem: (listId: string, itemId: string, packed: boolean) => void;
  onClearPacked: (listId: string) => void;
  onSetItems: (listId: string, itemIds: string[]) => void;
  onFlash: (msg: string) => void;
}

export function packingProgress(list: PackingList, existingItemIds: Set<string>) {
  const ids = list.itemIds.filter((id) => existingItemIds.has(id));
  const packed = new Set(list.packedItemIds);
  const done = ids.filter((id) => packed.has(id)).length;
  const total = ids.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return { done, total, pct };
}

function iconButtonStyle() {
  return {
    width: 34,
    height: 34,
    borderRadius: 99,
    border: "none",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0
  };
}

export function PackingScreen(props: PackingScreenProps) {
  const {
    packingLists,
    items,
    spaces,
    onOpenItem,
    onCreateList,
    onRenameList,
    onDeleteList,
    onToggleItem,
    onClearPacked,
    onSetItems,
    onFlash
  } = props;
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [menuListId, setMenuListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const activeList = useMemo(() => packingLists.find((list) => list.id === activeListId) ?? null, [packingLists, activeListId]);
  const menuList = useMemo(() => packingLists.find((list) => list.id === menuListId) ?? null, [packingLists, menuListId]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const existingItemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const spaceNameById = useMemo(() => new Map(spaces.map((space) => [space.id, space.name])), [spaces]);

  const activeItems = useMemo(() => {
    if (!activeList) return [];
    return activeList.itemIds.map((id) => itemById.get(id)).filter((item): item is Item => Boolean(item));
  }, [activeList, itemById]);

  const pickerSections = useMemo(() => {
    return spaces
      .map((space) => ({
        spaceId: space.id,
        spaceName: space.name,
        items: items.filter((item) =>
          item.spaceId === space.id && matchesPackingItemPickerQuery(pickerQuery, [item.name, item.areaNameSnapshot, space.name])
        )
      }))
      .filter((section) => section.items.length > 0);
  }, [items, pickerQuery, spaces]);

  function openCreate() {
    setCreating(true);
    setRenamingListId(null);
  }

  function submitCreate() {
    const name = newListName.trim();
    if (!name) return;
    onCreateList(name);
    setNewListName("");
    setCreating(false);
    onFlash("Packing list created");
  }

  function startRename(list: PackingList) {
    setMenuListId(null);
    setCreating(false);
    setRenamingListId(list.id);
    setRenameValue(list.name);
  }

  function commitRename() {
    if (!renamingListId) return;
    const current = packingLists.find((list) => list.id === renamingListId);
    const name = renameValue.trim();
    if (current && name && name !== current.name) {
      onRenameList(renamingListId, name);
      onFlash("Packing list renamed");
    }
    setRenamingListId(null);
    setRenameValue("");
  }

  function cancelRename() {
    setRenamingListId(null);
    setRenameValue("");
  }

  function deleteList(list: PackingList) {
    onDeleteList(list.id);
    setMenuListId(null);
    setRenamingListId((id) => (id === list.id ? null : id));
    if (activeListId === list.id) setActiveListId(null);
    onFlash("Packing list deleted");
  }

  function openPicker() {
    if (!activeList) return;
    setPickerSelected(new Set(activeList.itemIds));
    setPickerQuery("");
    setPickerOpen(true);
  }

  function commitPicker() {
    if (activeList) {
      onSetItems(activeList.id, [...pickerSelected]);
      onFlash("Packing list updated");
    }
    setPickerOpen(false);
  }

  function togglePickerItem(id: string) {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commitRename();
    if (event.key === "Escape") cancelRename();
  }

  if (!activeList) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--stow-canvas)" }}>
        <div style={{ padding: "calc(env(safe-area-inset-top) + 24px) 24px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 900,
                color: "var(--stow-ink)",
                fontFamily: "var(--stow-display)"
              }}
            >
              Packing
            </h1>
            <button
              type="button"
              onClick={openCreate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "9px 14px",
                borderRadius: 99,
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                background: "var(--stow-accent)",
                color: "#fff",
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap"
              }}
            >
              <Plus size={15} color="#fff" /> New List
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 150px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {packingLists.map((list) => {
              const { done, total, pct } = packingProgress(list, existingItemIds);
              const isRenaming = renamingListId === list.id;

              return (
                <div
                  key={list.id}
                  onClick={() => {
                    if (!isRenaming) setActiveListId(list.id);
                  }}
                  style={{ ...cardStyle, padding: 18, cursor: isRenaming ? "default" : "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {isRenaming ? (
                        <div onClick={(event) => event.stopPropagation()} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(event) => setRenameValue(event.target.value)}
                            onKeyDown={onRenameKeyDown}
                            onBlur={commitRename}
                            style={{
                              minWidth: 0,
                              flex: 1,
                              boxSizing: "border-box",
                              border: "1.5px solid var(--stow-accent)",
                              borderRadius: 10,
                              padding: "8px 10px",
                              fontSize: 15,
                              fontWeight: 800,
                              color: "var(--stow-ink)",
                              outline: "none",
                              background: "var(--stow-canvas)",
                              fontFamily: "inherit"
                            }}
                          />
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={commitRename}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 99,
                              border: "none",
                              background: "var(--stow-accent)",
                              color: "#fff",
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: "pointer",
                              fontFamily: "inherit"
                            }}
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              fontSize: 17,
                              fontWeight: 800,
                              color: "var(--stow-ink)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {list.name}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--stow-warm)", marginTop: 2 }}>
                            {done} of {total} packed
                          </div>
                        </>
                      )}
                    </div>
                    {!isRenaming ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? "var(--stow-success)" : "var(--stow-accent)" }}>
                          {pct}%
                        </div>
                        <button
                          type="button"
                          aria-label={`${list.name} list actions`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuListId(list.id);
                          }}
                          style={iconButtonStyle()}
                        >
                          <MoreHorizontal size={18} color="var(--stow-warm)" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <ProgressBar value={done} total={total} />
                  </div>
                </div>
              );
            })}

            {creating ? (
              <div style={{ ...cardStyle, padding: 16 }}>
                <Field label="List name" value={newListName} onChange={setNewListName} placeholder="e.g. Summer trip" />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <Button variant="neutral" onClick={() => setCreating(false)} style={{ padding: "12px 0" }}>
                    Cancel
                  </Button>
                  <Button variant="primary" disabled={!newListName.trim()} onClick={submitCreate} style={{ padding: "12px 0" }}>
                    <Plus size={15} color="#fff" /> Create
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={openCreate}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "20px 0",
                  borderRadius: "calc(var(--stow-radius-card) + 4px)",
                  border: "2px dashed var(--stow-border)",
                  color: "var(--stow-warm)",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  background: "transparent",
                  fontFamily: "inherit"
                }}
              >
                <Plus size={16} strokeWidth={2.5} color="var(--stow-warm)" /> New Packing List
              </button>
            )}
          </div>
        </div>

        <ActionSheet
          open={Boolean(menuList)}
          title={menuList?.name}
          onClose={() => setMenuListId(null)}
          actions={[
            {
              label: "Rename",
              icon: Pencil,
              onSelect: () => {
                if (menuList) startRename(menuList);
              }
            },
            {
              label: "Delete",
              icon: Trash2,
              destructive: true,
              onSelect: () => {
                if (menuList) deleteList(menuList);
              }
            }
          ]}
        />
      </div>
    );
  }

  const { done, total, pct } = packingProgress(activeList, existingItemIds);
  const packedIds = new Set(activeList.packedItemIds);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--stow-canvas)" }}>
      <div
        style={{
          padding: "calc(env(safe-area-inset-top) + 16px) 16px 14px",
          background: "color-mix(in srgb, var(--stow-surface) 90%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--stow-border-l)",
          position: "sticky",
          top: 0,
          zIndex: 20
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={() => setActiveListId(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--stow-accent)",
              fontWeight: 700,
              fontSize: 15,
              padding: 4,
              fontFamily: "inherit"
            }}
          >
            <ChevronLeft size={20} strokeWidth={2.5} color="var(--stow-accent)" /> Lists
          </button>
          <button
            type="button"
            disabled={done === 0}
            onClick={() => {
              onClearPacked(activeList.id);
              onFlash("Packed items cleared");
            }}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--stow-warm)",
              background: "none",
              border: "none",
              cursor: done === 0 ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: done === 0 ? 0.45 : 1
            }}
          >
            Clear all
          </button>
        </div>
        <h1 style={{ margin: "8px 4px 10px", fontSize: 24, fontWeight: 900, color: "var(--stow-ink)" }}>{activeList.name}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
          <div style={{ flex: 1 }}>
            <ProgressBar value={done} total={total} />
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: pct === 100 ? "var(--stow-success)" : "var(--stow-ink-muted)",
              whiteSpace: "nowrap"
            }}
          >
            {done}/{total}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 150px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeItems.map((item) => {
            const packed = packedIds.has(item.id);
            const imageUrl = item.image?.downloadUrl;

            return (
              <div
                key={item.id}
                style={{
                  ...cardStyle,
                  borderRadius: "calc(var(--stow-radius-card) + 4px)",
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: packed ? 0.6 : 1
                }}
              >
                <button
                  type="button"
                  aria-label={packed ? `Mark ${item.name} unpacked` : `Mark ${item.name} packed`}
                  onClick={() => onToggleItem(activeList.id, item.id, !packed)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 99,
                    flexShrink: 0,
                    border: packed ? "none" : "2px solid var(--stow-border)",
                    background: packed ? "var(--stow-success)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: 0
                  }}
                >
                  {packed ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenItem(item.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    border: "none",
                    padding: 0,
                    background: "transparent",
                    textAlign: "left",
                    fontFamily: "inherit"
                  }}
                >
                  {imageUrl ? (
                    <img src={imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: "var(--stow-canvas)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <Inbox size={16} color="var(--stow-warm)" />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--stow-ink)",
                        textDecoration: packed ? "line-through" : "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {item.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--stow-warm)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {spaceNameById.get(item.spaceId) ?? ""} {"\u00b7"} {item.areaNameSnapshot}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={openPicker}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "18px 0",
            marginTop: 12,
            borderRadius: "calc(var(--stow-radius-card) + 4px)",
            border: "2px dashed var(--stow-border)",
            color: "var(--stow-warm)",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            background: "transparent",
            fontFamily: "inherit"
          }}
        >
          <Plus size={16} strokeWidth={2.5} color="var(--stow-warm)" /> Add Items
        </button>
      </div>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Select Items">
        <div style={{ display: "flex", flexDirection: "column", minHeight: 360 }}>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Search
              size={16}
              color="var(--stow-warm)"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            />
            <input
              autoFocus
              value={pickerQuery}
              onChange={(event) => setPickerQuery(event.target.value)}
              placeholder="Search items, areas, spaces..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: "var(--stow-radius-input)",
                padding: "12px 38px 12px 40px",
                fontSize: 15,
                fontWeight: 500,
                outline: "none",
                border: `1.5px solid ${pickerQuery.trim() ? "var(--stow-accent)" : "var(--stow-border)"}`,
                background: "var(--stow-canvas)",
                color: "var(--stow-ink)",
                fontFamily: "inherit"
              }}
            />
            {pickerQuery.trim() ? (
              <button
                type="button"
                aria-label="Clear item search"
                onClick={() => setPickerQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  ...iconButtonStyle()
                }}
              >
                <X size={15} color="var(--stow-warm)" />
              </button>
            ) : null}
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", margin: "0 -4px", padding: "0 4px 18px" }}>
            {pickerSections.length === 0 ? (
              <div style={{ textAlign: "center", padding: "44px 20px", color: "var(--stow-warm)" }}>
                <Inbox size={30} color="var(--stow-border)" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--stow-ink)" }}>No items found</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {pickerSections.map((section) => (
                  <div key={section.spaceId}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: 1.4,
                        color: "var(--stow-warm)",
                        margin: "0 0 8px 2px"
                      }}
                    >
                      {section.spaceName}
                    </div>
                    <div style={{ ...cardStyle, overflow: "hidden" }}>
                      {section.items.map((item, index) => {
                        const selected = pickerSelected.has(item.id);
                        const imageUrl = item.image?.downloadUrl;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => togglePickerItem(item.id)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "12px 14px",
                              border: "none",
                              borderTop: index === 0 ? "none" : "1px solid var(--stow-border-l)",
                              background: selected ? "color-mix(in srgb, var(--stow-accent) 8%, var(--stow-surface))" : "transparent",
                              cursor: "pointer",
                              textAlign: "left",
                              fontFamily: "inherit"
                            }}
                          >
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt=""
                                style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 10,
                                  background: "var(--stow-canvas)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0
                                }}
                              >
                                <Inbox size={15} color="var(--stow-warm)" />
                              </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 15,
                                  fontWeight: 750,
                                  color: "var(--stow-ink)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap"
                                }}
                              >
                                {item.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: "var(--stow-warm)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  marginTop: 2
                                }}
                              >
                                {item.areaNameSnapshot}
                              </div>
                            </div>
                            <span
                              aria-hidden="true"
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 99,
                                border: selected ? "none" : "2px solid var(--stow-border)",
                                background: selected ? "var(--stow-accent)" : "transparent",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                              }}
                            >
                              {selected ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingTop: 14,
              borderTop: "1px solid var(--stow-border-l)"
            }}
          >
            <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: "var(--stow-warm)" }}>
              {pickerSelected.size} selected
            </div>
            <Button variant="primary" onClick={commitPicker} style={{ width: 128, padding: "12px 0" }}>
              Done
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
