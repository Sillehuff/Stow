import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { serverTimestamp, Timestamp } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import type { ImageRef, ItemStatus } from "@/types/domain";
import type { VisionSuggestion } from "@/types/llm";
import { useWorkspaceData } from "@/features/stow/hooks/useWorkspaceData";
import { buildActivityEntry, inventoryRepository } from "@/features/stow/services/repository";
import { isActivityPath, useMobileNavigation } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import type { MobileTab } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import { applyPalette, makePalette } from "@/features/stow/ui/mobile/theme/palette";
import { Pencil, QrCode, ScanLine } from "@/features/stow/ui/mobile/theme/icons";
import { AddAreaSheet } from "@/features/stow/ui/mobile/add/AddAreaSheet";
import { AddItemSheet } from "@/features/stow/ui/mobile/add/AddItemSheet";
import type { AddItemInitial } from "@/features/stow/ui/mobile/add/AddItemSheet";
import { AddSpaceSheet } from "@/features/stow/ui/mobile/add/AddSpaceSheet";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { ActivityScreen } from "@/features/stow/ui/mobile/screens/ActivityScreen";
import { CaptureFirst } from "@/features/stow/ui/mobile/capture/CaptureFirst";
import { PhotoSource } from "@/features/stow/ui/mobile/capture/PhotoSource";
import { QuickCapture } from "@/features/stow/ui/mobile/capture/QuickCapture";
import { ScanOverlay } from "@/features/stow/ui/mobile/capture/ScanOverlay";
// Lazy: QrScanOverlay pulls in the jsQR decoder (~15 kB), which only matters when the
// user actually opens the QR scanner — keep it out of the main workspace chunk.
const QrScanOverlay = lazy(() =>
  import("@/features/stow/ui/mobile/capture/QrScanOverlay").then((module) => ({ default: module.QrScanOverlay }))
);
import { HomeScreen } from "@/features/stow/ui/mobile/screens/HomeScreen";
import { ItemDetail } from "@/features/stow/ui/mobile/screens/ItemDetail";
import { PackingScreen } from "@/features/stow/ui/mobile/screens/PackingScreen";
import { RoomScreen } from "@/features/stow/ui/mobile/screens/RoomScreen";
import { SearchScreen } from "@/features/stow/ui/mobile/screens/SearchScreen";
import { SettingsScreen } from "@/features/stow/ui/mobile/screens/SettingsScreen";
import type { SpacesListProps } from "@/features/stow/ui/mobile/screens/SpacesList";
import { EditSpaceSheet } from "@/features/stow/ui/mobile/spaces/EditSpaceSheet";
import { SpaceQrSheet } from "@/features/stow/ui/mobile/spaces/SpaceQrSheet";
import { SpaceActionSheet } from "@/features/stow/ui/mobile/spaces/SpaceActionSheet";
import { ActionSheet } from "@/features/stow/ui/mobile/shell/ActionSheet";
import { BottomNav } from "@/features/stow/ui/mobile/shell/BottomNav";
import { Confirm } from "@/features/stow/ui/mobile/shell/Confirm";
import { Toast } from "@/features/stow/ui/mobile/shell/Toast";
import { readDefaultSpaceId } from "@/features/stow/ui/mobile/preferences";
import { completeWrite } from "@/lib/firebase/completeWrite";
import { visionCategorizeItemImage } from "@/lib/firebase/functions";
import { storagePaths } from "@/lib/firebase/paths";
import { bestEffortDeleteImage, uploadFileToStorage } from "@/lib/firebase/storage";
import "@/features/stow/ui/mobile/theme/tokens.css";

interface StowMobileAppProps {
  householdId: string;
  user: User;
  onSignOut: () => void;
  online: boolean;
  basePath?: string;
}

export function StowMobileApp({ householdId, user, onSignOut, online, basePath = "" }: StowMobileAppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shelfPreviewUrlRef = useRef<string | null>(null);
  // Tracks an item the user is deleting from its own detail view, so the live-subscription
  // "that item was removed" effect doesn't clobber the success toast / yank them to Spaces.
  const selfDeletingIdRef = useRef<string | null>(null);
  const location = useLocation();
  const nav = useMobileNavigation(householdId, basePath);
  const data = useWorkspaceData(householdId, user);
  const [toast, setToast] = useState<string | null>(null);
  const [spaceMenuId, setSpaceMenuId] = useState<string | null>(null);
  const [renamingSpaceId, setRenamingSpaceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [shelfCapture, setShelfCapture] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [scanMenuOpen, setScanMenuOpen] = useState(false);

  const flash = (message: string) => setToast(message);

  // With the persistent local cache, write promises resolve only on server ack, so
  // awaiting them offline hangs the UI forever even though the local write already
  // applied. Wrap every awaited mutation: offline it resolves immediately and a
  // later server-side rejection (e.g. security rules) is surfaced via toast.
  function guardWrite(write: Promise<unknown>, rejectedMessage: string): Promise<boolean> {
    return completeWrite(write, () => online, () => flash(rejectedMessage));
  }

  // A slow AI scan must never clobber what the user is doing by the time it resolves.
  // Each scan takes a ticket; a stale ticket (a newer scan started) or a busy overlay
  // at resolution time means the result — and its uploaded photo — are discarded.
  const scanTicketRef = useRef(0);
  const overlayKindRef = useRef(nav.overlay.kind);
  overlayKindRef.current = nav.overlay.kind;

  function scanResultStale(ticket: number) {
    return ticket !== scanTicketRef.current || overlayKindRef.current != null;
  }

  function discardScanResult(image: ImageRef) {
    void bestEffortDeleteImage(image);
    flash("AI scan discarded");
  }

  function logActivitySafe(entry: Parameters<typeof buildActivityEntry>[0]) {
    data.actions
      .logActivity({ householdId, entry: buildActivityEntry(entry) })
      .catch((error) => console.error("Activity log failed", error));
  }

  useEffect(() => {
    if (rootRef.current) applyPalette(rootRef.current, makePalette());
  }, []);

  useEffect(() => {
    return () => {
      if (shelfPreviewUrlRef.current) URL.revokeObjectURL(shelfPreviewUrlRef.current);
    };
  }, []);

  const userId = data.userId ?? user.uid;
  const actorName = useMemo(() => {
    const member = data.members.find((candidate) => candidate.uid === userId);
    return member?.displayName ?? member?.email ?? "Someone";
  }, [data.members, userId]);
  const allTags = useMemo(() => Array.from(new Set(data.items.flatMap((item) => item.tags || []))), [data.items]);
  // The persisted "Default space" preference, but only when it still resolves to a live space.
  // Read fresh each render (not memoized): there's no change event when the Settings select
  // writes localStorage, so a stale memo would ignore a freshly-chosen default until spaces change.
  const savedDefaultSpaceId = readDefaultSpaceId();
  const preferredDefaultSpaceId =
    savedDefaultSpaceId && data.spaces.some((space) => space.id === savedDefaultSpaceId) ? savedDefaultSpaceId : null;

  // Count only items that still exist. list.itemIds can retain ids of items deleted
  // elsewhere; counting them raw leaves a phantom badge that never clears.
  const packedCount = useMemo(() => {
    const liveIds = new Set(data.items.map((item) => item.id));
    return data.packingLists.reduce((sum, list) => {
      const packed = new Set(list.packedItemIds);
      return sum + list.itemIds.filter((id) => liveIds.has(id) && !packed.has(id)).length;
    }, 0);
  }, [data.packingLists, data.items]);

  const selectedSpace = nav.selectedSpaceId ? data.spaces.find((space) => space.id === nav.selectedSpaceId) ?? null : null;
  const selectedItem = nav.selectedItemId ? data.items.find((item) => item.id === nav.selectedItemId) ?? null : null;
  const selectedItemSpace = selectedItem ? data.spaces.find((space) => space.id === selectedItem.spaceId) ?? null : null;
  const menuSpace = spaceMenuId ? data.spaces.find((space) => space.id === spaceMenuId) ?? null : null;

  const editSpacePayloadId = nav.overlay.kind === "editSpace" ? (nav.overlay.payload?.spaceId as string | undefined) : undefined;
  const editSpace = editSpacePayloadId ? data.spaces.find((space) => space.id === editSpacePayloadId) ?? null : null;

  const spaceQrPayloadId = nav.overlay.kind === "spaceQr" ? (nav.overlay.payload?.spaceId as string | undefined) : undefined;
  const spaceQrSpace = spaceQrPayloadId ? data.spaces.find((space) => space.id === spaceQrPayloadId) ?? null : null;

  const addAreaSpaceId = nav.overlay.kind === "addArea" ? (nav.overlay.payload?.spaceId as string | undefined) : undefined;
  const addAreaSpace = addAreaSpaceId ? data.spaces.find((space) => space.id === addAreaSpaceId) ?? null : null;
  const addItemInitial = nav.overlay.kind === "addItem" ? (nav.overlay.payload as AddItemInitial | undefined) : undefined;
  const activityOpen = isActivityPath(location.pathname, nav.basePath);

  const spaceMissing = Boolean(nav.selectedSpaceId && data.spaces.length > 0 && !selectedSpace);

  useEffect(() => {
    if (nav.selectedItemId && data.items.length > 0 && !selectedItem) {
      // A self-initiated delete handles its own toast + back-navigation; don't double-fire.
      if (nav.selectedItemId === selfDeletingIdRef.current) return;
      flash("That item was removed");
      nav.navigateToTab("spaces");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.selectedItemId, selectedItem, data.items.length]);

  function itemCountForSpace(spaceId: string) {
    return data.items.filter((item) => item.spaceId === spaceId).length;
  }

  const spacesListProps: Omit<SpacesListProps, "spaces" | "itemCountForSpace"> = {
    onOpenSpace: (spaceId) => nav.openSpace(spaceId),
    onOpenMenu: (spaceId) => setSpaceMenuId(spaceId),
    onReorder: (orderedIds) => {
      void data.actions.reorderSpaces({ householdId, orderedIds });
    },
    onRename: (spaceId, nextName) => {
      void guardWrite(
        data.actions.updateSpace({ householdId, spaceId, patch: { name: nextName } }),
        "A rename made offline couldn’t be saved"
      ).then((committed) => flash(committed ? "Space renamed" : "Renamed — will sync when you’re online"));
    },
    onAddSpace: () => nav.openOverlay("addSpace"),
    renamingId: renamingSpaceId,
    renameValue,
    onRenameValueChange: setRenameValue,
    onRenameCommit: () => {
      if (renamingSpaceId) {
        const space = data.spaces.find((candidate) => candidate.id === renamingSpaceId);
        const trimmed = renameValue.trim();
        if (trimmed && space && trimmed !== space.name) {
          void guardWrite(
            data.actions.updateSpace({ householdId, spaceId: renamingSpaceId, patch: { name: trimmed } }),
            "A rename made offline couldn’t be saved"
          ).then((committed) => flash(committed ? "Space renamed" : "Renamed — will sync when you’re online"));
        }
      }
      setRenamingSpaceId(null);
      setRenameValue("");
    },
    onRenameCancel: () => {
      setRenamingSpaceId(null);
      setRenameValue("");
    }
  };

  async function uploadDraftCapture(blob: Blob): Promise<ImageRef | null> {
    const draftId = inventoryRepository.createItemDraftId(householdId);
    const name = `photo-${Date.now()}.jpg`;
    const file = new File([blob], name, { type: blob.type || "image/jpeg" });
    try {
      return await uploadFileToStorage(storagePaths.draftImage(householdId, draftId, name), file, {
        contentType: file.type
      });
    } catch {
      flash("Upload failed. Try again.");
      return null;
    }
  }

  async function handlePhotoPicked(blob: Blob) {
    const ticket = ++scanTicketRef.current;
    nav.closeOverlay();
    const image = await uploadDraftCapture(blob);
    if (!image) return;
    if (scanResultStale(ticket)) {
      discardScanResult(image);
      return;
    }
    nav.openOverlay("addItem", {
      image,
      aiFilled: false,
      spaceId: nav.selectedSpaceId,
      areaId: nav.selectedAreaId
    });
  }

  async function handleScanSingle(blob: Blob) {
    const ticket = ++scanTicketRef.current;
    nav.closeOverlay();
    const image = await uploadDraftCapture(blob);
    if (!image) return;
    if (scanResultStale(ticket)) {
      discardScanResult(image);
      return;
    }

    let suggestion: VisionSuggestion | undefined;
    if (image.storagePath) {
      try {
        const response = await visionCategorizeItemImage({
          householdId,
          imageRef: { storagePath: image.storagePath },
          context: {
            spaceId: nav.selectedSpaceId ?? undefined,
            areaId: nav.selectedAreaId ?? undefined
          }
        });
        suggestion = response.suggestion;
      } catch {
        if (scanResultStale(ticket)) {
          discardScanResult(image);
          return;
        }
        flash("Couldn't read the photo — add details yourself.");
      }
    }

    if (scanResultStale(ticket)) {
      discardScanResult(image);
      return;
    }
    nav.openOverlay("addItem", {
      image,
      aiFilled: Boolean(suggestion),
      suggestion,
      spaceId: nav.selectedSpaceId,
      areaId: nav.selectedAreaId
    });
  }

  function clearShelfCapture() {
    if (shelfPreviewUrlRef.current) {
      URL.revokeObjectURL(shelfPreviewUrlRef.current);
      shelfPreviewUrlRef.current = null;
    }
    setShelfCapture(null);
  }

  function handleScanShelf(blob: Blob) {
    nav.closeOverlay();
    clearShelfCapture();
    const previewUrl = URL.createObjectURL(blob);
    shelfPreviewUrlRef.current = previewUrl;
    setShelfCapture({ blob, previewUrl });
  }

  // Full-screen capture overlays declare aria-modal but render as siblings over the still-mounted
  // app. Marking the background inert while one is open keeps keyboard/AT focus inside the overlay.
  const captureOverlayActive =
    nav.overlay.kind === "scan" ||
    nav.overlay.kind === "photo" ||
    nav.overlay.kind === "scanQr" ||
    nav.overlay.kind === "captureFirst" ||
    Boolean(shelfCapture);

  let screen: ReactNode = null;

  if (nav.tab === "spaces") {
    screen = spaceMissing ? (
      <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--stow-ink)" }}>Space not found</div>
        <div style={{ fontSize: 14, color: "var(--stow-ink-muted)" }}>
          It may have been deleted. QR labels for deleted spaces stop working.
        </div>
        <Button variant="primary" onClick={() => nav.navigateToTab("spaces")}>All Spaces</Button>
      </div>
    ) : selectedSpace ? (
      <RoomScreen
        space={selectedSpace}
        items={data.items}
        selectedAreaId={nav.selectedAreaId}
        onBack={() => nav.navigateToTab("spaces")}
        onClearArea={() => nav.openSpace(selectedSpace.id)}
        onOpenArea={(areaId) => nav.openSpace(selectedSpace.id, areaId)}
        onOpenItem={(itemId) => nav.openItem(itemId)}
        onAddArea={() => nav.openOverlay("addArea", { spaceId: selectedSpace.id })}
        onAddItem={(areaId) => nav.openOverlay("captureFirst", { spaceId: selectedSpace.id, areaId })}
        onOpenSpaceQr={() => nav.openOverlay("spaceQr", { spaceId: selectedSpace.id })}
      />
    ) : (
      <HomeScreen
        spaces={data.spaces}
        items={data.items}
        members={data.members}
        householdName={data.household?.name ?? "Your household"}
        onOpenItem={(itemId) => nav.openItem(itemId)}
        onBell={nav.goActivity}
        spacesList={spacesListProps}
      />
    );
  } else if (nav.tab === "search") {
    screen = (
      <SearchScreen
        householdId={householdId}
        items={data.items}
        spaces={data.spaces}
        onOpenItem={(itemId) => nav.openItem(itemId)}
      />
    );
  } else if (nav.tab === "packing") {
    screen = (
      <PackingScreen
        packingLists={data.packingLists}
        items={data.items}
        spaces={data.spaces}
        onOpenItem={(itemId) => nav.openItem(itemId)}
        onCreateList={(name) => {
          void data.actions.createPackingList({ householdId, userId, name, itemIds: [] });
        }}
        onRenameList={(listId, name) => {
          void data.actions.updatePackingList({ householdId, listId, userId, patch: { name } });
        }}
        onDeleteList={(listId) => {
          void data.actions.deletePackingList({ householdId, listId });
        }}
        onToggleItem={(listId, itemId, packed) => {
          void data.actions.togglePackingListItem({ householdId, listId, userId, itemId, packed });
        }}
        onClearPacked={(listId) => {
          void data.actions.clearPackingListPacked({ householdId, listId, userId });
        }}
        onSetItems={(listId, itemIds, packedItemIds) => {
          void data.actions.updatePackingList({ householdId, listId, userId, patch: { itemIds, packedItemIds } });
        }}
        onFlash={flash}
      />
    );
  } else if (nav.tab === "settings") {
    screen = (
      <SettingsScreen
        householdId={householdId}
        householdName={data.household?.name ?? "Your household"}
        currentUserId={data.userId}
        members={data.members}
        invites={data.invites}
        spaces={data.spaces}
        items={data.items}
        llmConfig={data.llmConfig}
        online={online}
        onRenameHousehold={(name) => {
          void guardWrite(
            data.actions.updateHousehold({ householdId, patch: { name } }),
            "A rename made offline couldn’t be saved"
          ).then((committed) => flash(committed ? "Household renamed" : "Renamed — will sync when you’re online"));
        }}
        onSignOut={onSignOut}
        onFlash={flash}
      />
    );
  }

  // Listener failures were previously recorded but never rendered — a member removed
  // from the household (or a dead connection) just saw silently frozen data.
  const accessRevoked = Object.values(data.errorsBySource).some((sourceError) => sourceError?.code === "permission-denied");

  return (
    <div className="stow-mobile" ref={rootRef}>
      <div className="stow-mobile__viewport">
        {data.error ? (
          <div
            role="alert"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              // Access loss must outrank every screen; a connectivity hiccup stays
              // beneath ItemDetail (z 60) and the capture overlays.
              zIndex: accessRevoked ? 200 : 55,
              padding: "calc(env(safe-area-inset-top) + 8px) 16px 8px",
              background: accessRevoked ? "var(--stow-danger)" : "var(--stow-ink)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10
            }}
          >
            <span style={{ flex: 1 }}>
              {accessRevoked
                ? "You no longer have access to this household."
                : "Some data isn’t syncing. Check your connection."}
            </span>
            {accessRevoked ? (
              <button
                type="button"
                onClick={onSignOut}
                style={{
                  border: "1px solid rgba(255,255,255,0.6)",
                  background: "transparent",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "5px 10px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
              >
                Sign out
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="stow-mobile__screen" inert={captureOverlayActive || undefined}>
          {screen}
        </div>

        {activityOpen ? (
          <ActivityScreen
            activity={data.activity}
            members={data.members}
            onBack={nav.back}
            onOpenItem={nav.openItem}
            onOpenSpace={(spaceId) => nav.openSpace(spaceId)}
          />
        ) : null}

        {selectedItem ? (
          <ItemDetail
            householdId={householdId}
            item={selectedItem}
            space={selectedItemSpace}
            spaces={data.spaces}
            allTags={allTags}
            members={data.members}
            onBack={() => nav.back()}
            onSaveEdit={(patch) => {
              const updatePatch = {
                name: patch.name,
                // Persist null (not undefined) when the value is cleared: Firestore's
                // updateDoc rejects an undefined field, and Item.value is number | null.
                value: patch.value ?? null,
                notes: patch.notes,
                ...("image" in patch ? { image: patch.image ?? null } : {})
              };
              return guardWrite(
                data.actions.updateItem({
                  householdId,
                  itemId: selectedItem.id,
                  userId,
                  patch: updatePatch
                }),
                "An edit made offline couldn’t be saved"
              ).then(() => undefined);
            }}
            onToggleTag={(tag) => {
              const currentTags = selectedItem.tags || [];
              const nextTags = currentTags.includes(tag) ? currentTags.filter((candidate) => candidate !== tag) : [...currentTags, tag];
              void data.actions.updateItem({ householdId, itemId: selectedItem.id, userId, patch: { tags: nextTags } });
            }}
            onMove={(dest) => {
              const destinationSpace = data.spaces.find((space) => space.id === dest.spaceId) ?? null;
              return (async () => {
                await guardWrite(
                  data.actions.updateItem({ householdId, itemId: selectedItem.id, userId, patch: dest }),
                  "A move made offline couldn’t be saved"
                );
                logActivitySafe({
                  type: "item_moved",
                  actorUid: userId,
                  actorName,
                  itemName: selectedItem.name,
                  spaceName: destinationSpace?.name,
                  areaName: dest.areaNameSnapshot,
                  spaceId: dest.spaceId,
                  areaId: dest.areaId,
                  itemId: selectedItem.id
                });
              })();
            }}
            onChangeStatus={async (next: ItemStatus) => {
              if (next === selectedItem.status) return; // re-tapping "lent" must not wipe the loan
              if (selectedItem.status === "lent") {
                await guardWrite(
                  data.actions.clearItemLoan({ householdId, itemId: selectedItem.id, userId, nextStatus: next }),
                  "A status change made offline couldn’t be saved"
                );
              } else {
                await guardWrite(
                  data.actions.setItemStatus({ householdId, itemId: selectedItem.id, userId, status: next }),
                  "A status change made offline couldn’t be saved"
                );
              }
              logActivitySafe({
                type: "item_status_changed",
                actorUid: userId,
                actorName,
                itemName: selectedItem.name,
                status: next,
                itemId: selectedItem.id
              });
            }}
            onConfirmLoan={async (loan) => {
              await guardWrite(
                data.actions.setItemLoan({
                  householdId,
                  itemId: selectedItem.id,
                  userId,
                  loan: {
                    to: loan.to,
                    ...(loan.toUid ? { toUid: loan.toUid } : {}),
                    since: serverTimestamp() as unknown as Timestamp,
                    ...(loan.dueMs ? { due: Timestamp.fromMillis(loan.dueMs) } : {}),
                    ...(loan.note ? { note: loan.note } : {})
                  }
                }),
                "A loan recorded offline couldn’t be saved"
              );
              logActivitySafe({
                type: "item_status_changed",
                actorUid: userId,
                actorName,
                itemName: selectedItem.name,
                status: "lent",
                loanTo: loan.to,
                itemId: selectedItem.id
              });
            }}
            onDelete={() => setDeleteItemId(selectedItem.id)}
            onFlash={flash}
          />
        ) : null}

        {!selectedItem ? (
          <div inert={captureOverlayActive || undefined} style={{ display: "contents" }}>
            <BottomNav
              tab={nav.tab}
              onTab={(tab: MobileTab) => nav.navigateToTab(tab)}
              onScan={() => setScanMenuOpen(true)}
              packedCount={packedCount}
            />
          </div>
        ) : null}

        <ActionSheet
          open={scanMenuOpen}
          onClose={() => setScanMenuOpen(false)}
          actions={[
            {
              label: "AI Scan",
              icon: ScanLine,
              onSelect: () => {
                setScanMenuOpen(false);
                nav.openOverlay("scan");
              }
            },
            {
              label: "Scan QR label",
              icon: QrCode,
              onSelect: () => {
                setScanMenuOpen(false);
                nav.openOverlay("scanQr");
              }
            },
            {
              label: "Add manually",
              icon: Pencil,
              onSelect: () => {
                setScanMenuOpen(false);
                nav.openOverlay("addItem");
              }
            }
          ]}
        />

        <SpaceActionSheet
          space={menuSpace}
          itemCount={menuSpace ? itemCountForSpace(menuSpace.id) : 0}
          open={spaceMenuId != null}
          onClose={() => setSpaceMenuId(null)}
          onEdit={() => {
            if (spaceMenuId) nav.openOverlay("editSpace", { spaceId: spaceMenuId });
            setSpaceMenuId(null);
          }}
          onRename={() => {
            if (menuSpace) {
              setRenamingSpaceId(menuSpace.id);
              setRenameValue(menuSpace.name);
            }
            setSpaceMenuId(null);
          }}
          onDelete={() => {
            if (spaceMenuId) nav.openOverlay("editSpace", { spaceId: spaceMenuId });
            setSpaceMenuId(null);
          }}
        />

        {editSpace ? (
          <EditSpaceSheet
            space={editSpace}
            itemCount={itemCountForSpace(editSpace.id)}
            items={data.items}
            otherSpaces={data.spaces.filter((space) => space.id !== editSpace.id)}
            onClose={() => nav.closeOverlay()}
            onSaved={(message) => {
              nav.closeOverlay();
              flash(message);
            }}
            onDeleted={(message) => {
              nav.closeOverlay();
              if (nav.selectedSpaceId === editSpace.id) nav.navigateToTab("spaces");
              flash(message);
            }}
            onError={flash}
            actions={{
              // The sheet awaits these; guardWrite keeps them from hanging offline.
              updateSpace: async (input) => {
                await guardWrite(data.actions.updateSpace(input), "A space edit made offline couldn’t be saved");
              },
              // The sheet consumes the new area's id, which the write promise can't
              // deliver offline — pre-generate it so the id resolves either way.
              createArea: async (input) => {
                const areaId = data.actions.createAreaId(input.householdId, input.spaceId);
                await guardWrite(
                  data.actions.createArea({ ...input, areaId }),
                  "An area added offline couldn’t be saved"
                );
                return areaId;
              },
              updateArea: async (input) => {
                await guardWrite(data.actions.updateArea(input), "An area edit made offline couldn’t be saved");
              },
              deleteArea: async (input) => {
                await guardWrite(data.actions.deleteArea(input), "An area deleted offline couldn’t be removed");
              },
              reorderAreas: async (input) => {
                await guardWrite(data.actions.reorderAreas(input), "A reorder made offline couldn’t be saved");
              },
              deleteSpace: async (input) => {
                await guardWrite(data.actions.deleteSpace(input), "A space deleted offline couldn’t be removed");
                logActivitySafe({
                  type: "space_deleted",
                  actorUid: input.userId,
                  actorName,
                  spaceName: editSpace.name,
                  spaceId: editSpace.id
                });
              }
            }}
            householdId={householdId}
            userId={userId}
          />
        ) : null}

        <AddSpaceSheet
          open={nav.overlay.kind === "addSpace"}
          spaceCount={data.spaces.length}
          onClose={() => nav.closeOverlay()}
          onCreate={async (input) => {
            const write = data.actions
              .createSpace({
                householdId,
                userId,
                name: input.name,
                icon: "box",
                color: input.color,
                position: input.position,
                areas: input.areas
              })
              .then((spaceId) => {
                // Best-effort: an activity-log failure must not look like a failed save.
                data.actions
                  .logActivity({
                    householdId,
                    entry: buildActivityEntry({
                      type: "space_added",
                      actorUid: userId,
                      actorName,
                      spaceName: input.name,
                      spaceId
                    })
                  })
                  .catch((error) => console.error("Activity log failed", error));
                return spaceId;
              });
            const committed = await completeWrite(write, () => online, () =>
              flash("A space you added offline couldn’t be saved")
            );
            flash(committed ? "Space created" : "Space saved — will sync when you’re online");
            nav.closeOverlay();
          }}
        />

        <AddAreaSheet
          open={nav.overlay.kind === "addArea" && addAreaSpace != null}
          areaCount={addAreaSpace?.areas.length ?? 0}
          onClose={() => nav.closeOverlay()}
          onCreate={async (input) => {
            if (addAreaSpace) {
              const committed = await completeWrite(
                data.actions.createArea({
                  householdId,
                  spaceId: addAreaSpace.id,
                  name: input.name,
                  position: input.position
                }),
                () => online,
                () => flash("An area you added offline couldn’t be saved")
              );
              flash(committed ? "Area added" : "Area saved — will sync when you’re online");
            }
            nav.closeOverlay();
          }}
        />

        <AddItemSheet
          open={nav.overlay.kind === "addItem"}
          householdId={householdId}
          spaces={data.spaces}
          initial={addItemInitial}
          defaultSpaceId={addItemInitial?.spaceId ?? nav.selectedSpaceId ?? preferredDefaultSpaceId}
          defaultAreaId={addItemInitial?.areaId ?? nav.selectedAreaId}
          onClose={() => nav.closeOverlay()}
          onCreate={async (input) => {
            const destinationSpace = data.spaces.find((space) => space.id === input.spaceId) ?? null;
            const write = data.actions
              .createItem({
                householdId,
                userId,
                name: input.name,
                spaceId: input.spaceId,
                areaId: input.areaId,
                areaNameSnapshot: input.areaNameSnapshot,
                value: input.value ?? undefined,
                tags: input.tags,
                notes: input.notes,
                image: input.image ?? undefined,
                entryMode: input.entryMode
              })
              .then((itemId) => {
                // Best-effort: an activity-log failure must not look like a failed save (it caused duplicate items on retry).
                data.actions
                  .logActivity({
                    householdId,
                    entry: buildActivityEntry({
                      type: "item_added",
                      actorUid: userId,
                      actorName,
                      itemName: input.name,
                      spaceName: destinationSpace?.name,
                      areaName: input.areaNameSnapshot,
                      spaceId: input.spaceId,
                      areaId: input.areaId,
                      itemId
                    })
                  })
                  .catch((error) => console.error("Activity log failed", error));
                return itemId;
              });
            const committed = await completeWrite(write, () => online, () =>
              flash("An item you added offline couldn’t be saved")
            );
            flash(committed ? "Item added" : "Item saved — will sync when you’re online");
            nav.closeOverlay();
          }}
        />

        {nav.overlay.kind === "photo" ? (
          <PhotoSource onClose={nav.closeOverlay} onPicked={(blob) => void handlePhotoPicked(blob)} />
        ) : null}

        {nav.overlay.kind === "scan" ? (
          <ScanOverlay
            onClose={nav.closeOverlay}
            onCaptureSingle={(blob) => void handleScanSingle(blob)}
            onCaptureShelf={handleScanShelf}
          />
        ) : null}

        {nav.overlay.kind === "spaceQr" ? (
          <SpaceQrSheet open space={spaceQrSpace} onClose={nav.closeOverlay} onFlash={flash} />
        ) : null}

        {nav.overlay.kind === "scanQr" ? (
          <Suspense fallback={null}>
            <QrScanOverlay onClose={nav.closeOverlay} onOpenPath={nav.openPath} onFlash={flash} />
          </Suspense>
        ) : null}

        {shelfCapture ? (
          <QuickCapture
            householdId={householdId}
            spaceId={nav.selectedSpaceId ?? undefined}
            areaId={nav.selectedAreaId ?? undefined}
            spaces={data.spaces}
            userId={userId}
            actorName={actorName}
            createItemsBatch={data.actions.createItemsBatch}
            logActivity={data.actions.logActivity}
            capturedBlob={shelfCapture.blob}
            capturedPreviewUrl={shelfCapture.previewUrl}
            isOnline={() => online}
            onQueuedWriteRejected={() => flash("Some items added offline couldn’t be saved")}
            onClose={clearShelfCapture}
            onCommitted={(count, committed) => {
              clearShelfCapture();
              flash(
                committed
                  ? `Added ${count} item${count !== 1 ? "s" : ""}`
                  : "Saved — will sync when you’re online"
              );
            }}
          />
        ) : null}

        {nav.overlay.kind === "captureFirst" ? (
          <CaptureFirst
            householdId={householdId}
            spaceId={(nav.overlay.payload?.spaceId as string | undefined) ?? nav.selectedSpaceId}
            areaId={(nav.overlay.payload?.areaId as string | undefined) ?? nav.selectedAreaId}
            onClose={nav.closeOverlay}
            onCreated={(itemId) => {
              nav.closeOverlay();
              nav.openItem(itemId);
            }}
            onOpenDetails={(payload) => nav.openOverlay("addItem", { ...payload })}
          />
        ) : null}

        <Confirm
          open={deleteItemId != null}
          title="Delete item?"
          body="This removes it from your inventory and any packing lists. This can't be undone."
          confirmLabel="Delete"
          danger
          onCancel={() => {
            if (!deleteSaving) setDeleteItemId(null);
          }}
          onConfirm={() => {
            if (!deleteItemId || deleteSaving) return;
            const itemIdToDelete = deleteItemId;
            const itemToDelete = data.items.find((item) => item.id === itemIdToDelete);
            const imageToClean = itemToDelete?.image;
            const shouldReturn = nav.selectedItemId === itemIdToDelete;
            if (shouldReturn) selfDeletingIdRef.current = itemIdToDelete;
            setDeleteSaving(true);
            setDeleteItemId(null);
            void (async () => {
              try {
                const committed = await guardWrite(
                  data.actions.deleteItem({ householdId, itemId: itemIdToDelete, userId }),
                  "An item deleted offline couldn’t be removed"
                );
                logActivitySafe({
                  type: "item_deleted",
                  actorUid: userId,
                  actorName,
                  itemName: itemToDelete?.name,
                  itemId: itemIdToDelete
                });
                if (imageToClean) void bestEffortDeleteImage(imageToClean);
                flash(committed ? "Item deleted" : "Item deleted — will sync when you’re online");
                if (shouldReturn) nav.back();
              } catch {
                flash("Couldn't delete item");
              } finally {
                setDeleteSaving(false);
                // Clear after the subscription has had a tick to drop the item, so the
                // "removed" effect stays suppressed for this self-delete but re-arms for
                // any genuine remote removal afterward.
                const clearedId = itemIdToDelete;
                setTimeout(() => {
                  if (selfDeletingIdRef.current === clearedId) selfDeletingIdRef.current = null;
                }, 1500);
              }
            })();
          }}
        />

        <Toast message={toast} onDone={() => setToast(null)} />
      </div>
    </div>
  );
}
