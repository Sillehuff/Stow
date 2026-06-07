import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { useLocation } from "react-router-dom";
import type { ImageRef } from "@/types/domain";
import type { VisionSuggestion } from "@/types/llm";
import { useWorkspaceData } from "@/features/stow/hooks/useWorkspaceData";
import { buildActivityEntry, inventoryRepository } from "@/features/stow/services/repository";
import { isActivityPath, useMobileNavigation } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import type { MobileTab } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import { applyPalette, makePalette } from "@/features/stow/ui/mobile/theme/palette";
import { AddAreaSheet } from "@/features/stow/ui/mobile/add/AddAreaSheet";
import { AddItemSheet } from "@/features/stow/ui/mobile/add/AddItemSheet";
import type { AddItemInitial } from "@/features/stow/ui/mobile/add/AddItemSheet";
import { AddSpaceSheet } from "@/features/stow/ui/mobile/add/AddSpaceSheet";
import { ActivityScreen } from "@/features/stow/ui/mobile/screens/ActivityScreen";
import { CaptureFirst } from "@/features/stow/ui/mobile/capture/CaptureFirst";
import { PhotoSource } from "@/features/stow/ui/mobile/capture/PhotoSource";
import { QuickCapture } from "@/features/stow/ui/mobile/capture/QuickCapture";
import { ScanOverlay } from "@/features/stow/ui/mobile/capture/ScanOverlay";
import { HomeScreen } from "@/features/stow/ui/mobile/screens/HomeScreen";
import { ItemDetail } from "@/features/stow/ui/mobile/screens/ItemDetail";
import { PackingScreen } from "@/features/stow/ui/mobile/screens/PackingScreen";
import { RoomScreen } from "@/features/stow/ui/mobile/screens/RoomScreen";
import { SearchScreen } from "@/features/stow/ui/mobile/screens/SearchScreen";
import { SettingsScreen } from "@/features/stow/ui/mobile/screens/SettingsScreen";
import type { SpacesListProps } from "@/features/stow/ui/mobile/screens/SpacesList";
import { EditSpaceSheet } from "@/features/stow/ui/mobile/spaces/EditSpaceSheet";
import { SpaceActionSheet } from "@/features/stow/ui/mobile/spaces/SpaceActionSheet";
import { BottomNav } from "@/features/stow/ui/mobile/shell/BottomNav";
import { Confirm } from "@/features/stow/ui/mobile/shell/Confirm";
import { Toast } from "@/features/stow/ui/mobile/shell/Toast";
import { visionCategorizeItemImage } from "@/lib/firebase/functions";
import { storagePaths } from "@/lib/firebase/paths";
import { bestEffortDeleteImage, uploadFileToStorage } from "@/lib/firebase/storage";
import "@/features/stow/ui/mobile/theme/tokens.css";

interface StowMobileAppProps {
  householdId: string;
  user: User;
  onSignOut: () => void;
  online: boolean;
}

export function StowMobileApp({ householdId, user, onSignOut, online }: StowMobileAppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shelfPreviewUrlRef = useRef<string | null>(null);
  const location = useLocation();
  const nav = useMobileNavigation(householdId);
  const data = useWorkspaceData(householdId, user);
  const [toast, setToast] = useState<string | null>(null);
  const [spaceMenuId, setSpaceMenuId] = useState<string | null>(null);
  const [renamingSpaceId, setRenamingSpaceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [shelfCapture, setShelfCapture] = useState<{ blob: Blob; previewUrl: string } | null>(null);

  const flash = (message: string) => setToast(message);

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

  const packedCount = data.packingLists.reduce(
    (sum, list) => sum + Math.max(0, list.itemIds.length - list.packedItemIds.length),
    0
  );

  const selectedSpace = nav.selectedSpaceId ? data.spaces.find((space) => space.id === nav.selectedSpaceId) ?? null : null;
  const selectedItem = nav.selectedItemId ? data.items.find((item) => item.id === nav.selectedItemId) ?? null : null;
  const selectedItemSpace = selectedItem ? data.spaces.find((space) => space.id === selectedItem.spaceId) ?? null : null;
  const menuSpace = spaceMenuId ? data.spaces.find((space) => space.id === spaceMenuId) ?? null : null;

  const editSpacePayloadId = nav.overlay.kind === "editSpace" ? (nav.overlay.payload?.spaceId as string | undefined) : undefined;
  const editSpace = editSpacePayloadId ? data.spaces.find((space) => space.id === editSpacePayloadId) ?? null : null;

  const addAreaSpaceId = nav.overlay.kind === "addArea" ? (nav.overlay.payload?.spaceId as string | undefined) : undefined;
  const addAreaSpace = addAreaSpaceId ? data.spaces.find((space) => space.id === addAreaSpaceId) ?? null : null;
  const addItemInitial = nav.overlay.kind === "addItem" ? (nav.overlay.payload as AddItemInitial | undefined) : undefined;
  const activityOpen = isActivityPath(location.pathname, nav.basePath);

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
      void data.actions.updateSpace({ householdId, spaceId, patch: { name: nextName } }).then(() => flash("Space renamed"));
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
          void data.actions.updateSpace({ householdId, spaceId: renamingSpaceId, patch: { name: trimmed } }).then(() => {
            flash("Space renamed");
          });
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
    nav.closeOverlay();
    const image = await uploadDraftCapture(blob);
    if (!image) return;
    nav.openOverlay("addItem", {
      image,
      aiFilled: false,
      spaceId: nav.selectedSpaceId,
      areaId: nav.selectedAreaId
    });
  }

  async function handleScanSingle(blob: Blob) {
    nav.closeOverlay();
    const image = await uploadDraftCapture(blob);
    if (!image) return;

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
        flash("Couldn't read the photo — add details yourself.");
      }
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

  let screen: ReactNode = null;

  if (nav.tab === "spaces") {
    screen = selectedSpace ? (
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
        onComingSoon={flash}
      />
    ) : (
      <HomeScreen
        spaces={data.spaces}
        items={data.items}
        householdName={data.household?.name ?? "Your household"}
        onOpenItem={(itemId) => nav.openItem(itemId)}
        onBell={nav.goActivity}
        spacesList={spacesListProps}
      />
    );
  } else if (nav.tab === "search") {
    screen = <SearchScreen items={data.items} spaces={data.spaces} onOpenItem={(itemId) => nav.openItem(itemId)} />;
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
        onSetItems={(listId, itemIds) => {
          void data.actions.updatePackingList({ householdId, listId, userId, patch: { itemIds } });
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
          void data.actions.updateHousehold({ householdId, patch: { name } }).then(() => flash("Household renamed"));
        }}
        onSignOut={onSignOut}
        onFlash={flash}
      />
    );
  }

  return (
    <div className="stow-mobile" ref={rootRef}>
      <div className="stow-mobile__viewport">
        <div className="stow-mobile__screen">{screen}</div>

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
            onBack={() => nav.back()}
            onTogglePacked={(next) => {
              void data.actions.togglePacked({ householdId, itemId: selectedItem.id, userId, nextValue: next });
            }}
            onSaveEdit={(patch) => {
              const updatePatch = {
                name: patch.name,
                value: patch.value ?? undefined,
                notes: patch.notes,
                ...("image" in patch ? { image: patch.image ?? null } : {})
              };
              return data.actions.updateItem({
                householdId,
                itemId: selectedItem.id,
                userId,
                patch: updatePatch
              });
            }}
            onToggleTag={(tag) => {
              const currentTags = selectedItem.tags || [];
              const nextTags = currentTags.includes(tag) ? currentTags.filter((candidate) => candidate !== tag) : [...currentTags, tag];
              void data.actions.updateItem({ householdId, itemId: selectedItem.id, userId, patch: { tags: nextTags } });
            }}
            onMove={(dest) => {
              const destinationSpace = data.spaces.find((space) => space.id === dest.spaceId) ?? null;
              void (async () => {
                await data.actions.updateItem({ householdId, itemId: selectedItem.id, userId, patch: dest });
                await data.actions.logActivity({
                  householdId,
                  entry: buildActivityEntry({
                    type: "item_moved",
                    actorUid: userId,
                    actorName,
                    itemName: selectedItem.name,
                    spaceName: destinationSpace?.name,
                    areaName: dest.areaNameSnapshot,
                    spaceId: dest.spaceId,
                    areaId: dest.areaId,
                    itemId: selectedItem.id
                  })
                });
              })();
            }}
            onDelete={() => setDeleteItemId(selectedItem.id)}
            onFlash={flash}
          />
        ) : null}

        {!selectedItem ? (
          <BottomNav
            tab={nav.tab}
            onTab={(tab: MobileTab) => nav.navigateToTab(tab)}
            onScan={() => nav.openOverlay("scan")}
            packedCount={packedCount}
          />
        ) : null}

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
            actions={{
              updateSpace: data.actions.updateSpace,
              createArea: data.actions.createArea,
              updateArea: data.actions.updateArea,
              deleteArea: data.actions.deleteArea,
              reorderAreas: data.actions.reorderAreas,
              deleteSpace: async (input) => {
                await data.actions.deleteSpace(input);
                await data.actions.logActivity({
                  householdId: input.householdId,
                  entry: buildActivityEntry({
                    type: "space_deleted",
                    actorUid: input.userId,
                    actorName,
                    spaceName: editSpace.name,
                    spaceId: editSpace.id
                  })
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
          onCreate={(input) => {
            void (async () => {
              const spaceId = await data.actions.createSpace({
                householdId,
                userId,
                name: input.name,
                icon: "box",
                color: input.color,
                position: input.position,
                areas: input.areas
              });
              await data.actions.logActivity({
                householdId,
                entry: buildActivityEntry({
                  type: "space_added",
                  actorUid: userId,
                  actorName,
                  spaceName: input.name,
                  spaceId
                })
              });
              flash("Space created");
            })();
            nav.closeOverlay();
          }}
        />

        <AddAreaSheet
          open={nav.overlay.kind === "addArea" && addAreaSpace != null}
          areaCount={addAreaSpace?.areas.length ?? 0}
          onClose={() => nav.closeOverlay()}
          onCreate={(input) => {
            if (addAreaSpace) {
              void data.actions
                .createArea({
                  householdId,
                  spaceId: addAreaSpace.id,
                  name: input.name,
                  position: input.position
                })
                .then(() => flash("Area added"));
            }
            nav.closeOverlay();
          }}
        />

        <AddItemSheet
          open={nav.overlay.kind === "addItem"}
          householdId={householdId}
          spaces={data.spaces}
          initial={addItemInitial}
          defaultSpaceId={addItemInitial?.spaceId ?? nav.selectedSpaceId}
          defaultAreaId={addItemInitial?.areaId ?? nav.selectedAreaId}
          onClose={() => nav.closeOverlay()}
          onCreate={async (input) => {
            const destinationSpace = data.spaces.find((space) => space.id === input.spaceId) ?? null;
            const itemId = await data.actions.createItem({
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
            });
            await data.actions.logActivity({
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
            });
            flash("Item added");
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
            onClose={clearShelfCapture}
            onCommitted={(count) => {
              clearShelfCapture();
              flash(`Added ${count} item${count !== 1 ? "s" : ""}`);
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
          onCancel={() => setDeleteItemId(null)}
          onConfirm={() => {
            if (deleteItemId) {
              const itemToDelete = data.items.find((item) => item.id === deleteItemId);
              const imageToClean = itemToDelete?.image;
              void (async () => {
                await data.actions.deleteItem({ householdId, itemId: deleteItemId, userId });
                await data.actions.logActivity({
                  householdId,
                  entry: buildActivityEntry({
                    type: "item_deleted",
                    actorUid: userId,
                    actorName,
                    itemName: itemToDelete?.name,
                    itemId: deleteItemId
                  })
                });
                if (imageToClean) void bestEffortDeleteImage(imageToClean);
                flash("Item deleted");
              })();
              if (nav.selectedItemId === deleteItemId) nav.back();
            }
            setDeleteItemId(null);
          }}
        />

        <Toast message={toast} onDone={() => setToast(null)} />
      </div>
    </div>
  );
}
