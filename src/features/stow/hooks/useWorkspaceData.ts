import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { ActivityEntry, Area, Household, HouseholdInvite, HouseholdMember, Item, ItemDraft, PackingList, Space, SpaceWithAreas } from "@/types/domain";
import type { HouseholdLlmConfig } from "@/types/llm";
import { inventoryRepository } from "@/features/stow/services/repository";
import { byPosition } from "@/features/stow/hooks/positionSort";

type CollectionState<T> = {
  items: T[];
  fromCache: boolean;
  hasPendingWrites: boolean;
};

function emptyState<T>(): CollectionState<T> {
  return { items: [], fromCache: true, hasPendingWrites: false };
}

export type WorkspaceActions = {
  createSpaceId: typeof inventoryRepository.createSpaceId;
  createAreaId: typeof inventoryRepository.createAreaId;
  createItemId: typeof inventoryRepository.createItemId;
  createItemDraftId: typeof inventoryRepository.createItemDraftId;
  updateHousehold: typeof inventoryRepository.updateHousehold;
  createSpace: typeof inventoryRepository.createSpace;
  createArea: typeof inventoryRepository.createArea;
  updateSpace: typeof inventoryRepository.updateSpace;
  updateArea: typeof inventoryRepository.updateArea;
  deleteSpace: typeof inventoryRepository.deleteSpace;
  deleteArea: typeof inventoryRepository.deleteArea;
  reorderSpaces: typeof inventoryRepository.reorderSpaces;
  reorderAreas: typeof inventoryRepository.reorderAreas;
  createItem: typeof inventoryRepository.createItem;
  createItemsBatch: typeof inventoryRepository.createItemsBatch;
  updateItem: typeof inventoryRepository.updateItem;
  togglePacked: typeof inventoryRepository.togglePacked;
  deleteItem: typeof inventoryRepository.deleteItem;
  createItemDraft: typeof inventoryRepository.createItemDraft;
  updateItemDraft: typeof inventoryRepository.updateItemDraft;
  completeItemDraft: typeof inventoryRepository.completeItemDraft;
  deleteItemDraft: typeof inventoryRepository.deleteItemDraft;
  updateMemberRole: typeof inventoryRepository.updateMemberRole;
  removeMember: typeof inventoryRepository.removeMember;
  revokeInvite: typeof inventoryRepository.revokeInvite;
  createPackingList: typeof inventoryRepository.createPackingList;
  updatePackingList: typeof inventoryRepository.updatePackingList;
  deletePackingList: typeof inventoryRepository.deletePackingList;
  togglePackingListItem: typeof inventoryRepository.togglePackingListItem;
  clearPackingListPacked: typeof inventoryRepository.clearPackingListPacked;
  logActivity: typeof inventoryRepository.logActivity;
  setItemStatus: typeof inventoryRepository.setItemStatus;
  setItemLoan: typeof inventoryRepository.setItemLoan;
  clearItemLoan: typeof inventoryRepository.clearItemLoan;
};

type WorkspaceErrorSource = "household" | "spaces" | "areas" | "items" | "itemDrafts" | "members" | "invites" | "llmConfig" | "packingLists" | "activity";
// Keep the Firestore error code (e.g. "permission-denied"): the UI distinguishes
// "removed from this household" from ordinary connectivity failures.
export type WorkspaceError = { code?: string; message: string };
type WorkspaceErrorsBySource = Record<WorkspaceErrorSource, WorkspaceError | null>;

function emptyErrors(): WorkspaceErrorsBySource {
  return {
    household: null,
    spaces: null,
    areas: null,
    items: null,
    itemDrafts: null,
    members: null,
    invites: null,
    llmConfig: null,
    packingLists: null,
    activity: null
  };
}

export function useWorkspaceData(householdId: string | null, user: User | null) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [spacesState, setSpacesState] = useState<CollectionState<Space>>(emptyState());
  const [areasState, setAreasState] = useState<CollectionState<Area>>(emptyState());
  const [itemsState, setItemsState] = useState<CollectionState<Item>>(emptyState());
  const [itemDraftsState, setItemDraftsState] = useState<CollectionState<ItemDraft>>(emptyState());
  const [membersState, setMembersState] = useState<CollectionState<HouseholdMember>>(emptyState());
  const [invitesState, setInvitesState] = useState<CollectionState<HouseholdInvite>>(emptyState());
  const [packingListsState, setPackingListsState] = useState<CollectionState<PackingList>>(emptyState());
  const [activityState, setActivityState] = useState<CollectionState<ActivityEntry>>(emptyState());
  const [llmConfig, setLlmConfig] = useState<HouseholdLlmConfig | null>(null);
  const [llmConfigMeta, setLlmConfigMeta] = useState({ fromCache: true, hasPendingWrites: false });
  const [errorsBySource, setErrorsBySource] = useState<WorkspaceErrorsBySource>(emptyErrors());

  const setSourceError = (source: WorkspaceErrorSource, error: Error | null) => {
    const maybeCode = error ? (error as { code?: unknown }).code : undefined;
    const next: WorkspaceError | null = error
      ? { code: typeof maybeCode === "string" ? maybeCode : undefined, message: error.message }
      : null;
    setErrorsBySource((prev) => {
      const current = prev[source];
      if (current === next) return prev;
      if (current && next && current.code === next.code && current.message === next.message) return prev;
      return { ...prev, [source]: next };
    });
  };

  useEffect(() => {
    setHousehold(null);
    setSpacesState(emptyState());
    setAreasState(emptyState());
    setItemsState(emptyState());
    setItemDraftsState(emptyState());
    setMembersState(emptyState());
    setInvitesState(emptyState());
    setPackingListsState(emptyState());
    setActivityState(emptyState());
    setLlmConfig(null);
    setLlmConfigMeta({ fromCache: true, hasPendingWrites: false });
    setErrorsBySource(emptyErrors());
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeHousehold(
      householdId,
      (nextHousehold) => {
        setHousehold(nextHousehold);
        setSourceError("household", null);
      },
      (e) => setSourceError("household", e)
    );
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeItemDrafts(
      householdId,
      (state) => {
        setItemDraftsState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites });
        setSourceError("itemDrafts", null);
      },
      (e) => setSourceError("itemDrafts", e)
    );
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeSpaces(
      householdId,
      (state) => {
        setSpacesState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites });
        setSourceError("spaces", null);
      },
      (e) => setSourceError("spaces", e)
    );
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeAreas(
      householdId,
      (state) => {
        setAreasState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites });
        setSourceError("areas", null);
      },
      (e) => setSourceError("areas", e)
    );
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeItems(
      householdId,
      (state) => {
        setItemsState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites });
        setSourceError("items", null);
      },
      (e) => setSourceError("items", e)
    );
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeMembers(
      householdId,
      (state) => {
        setMembersState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites });
        setSourceError("members", null);
      },
      (e) => setSourceError("members", e)
    );
    return () => unsub();
  }, [householdId]);

  const currentUserRole = useMemo(
    () => membersState.items.find((member) => member.uid === user?.uid)?.role ?? null,
    [membersState.items, user?.uid]
  );
  const canManageHouseholdSettings = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  useEffect(() => {
    if (!householdId || !canManageHouseholdSettings) {
      setInvitesState(emptyState());
      setSourceError("invites", null);
      return;
    }
    const unsub = inventoryRepository.subscribeInvites(
      householdId,
      (state) => {
        setInvitesState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites });
        setSourceError("invites", null);
      },
      (e) => setSourceError("invites", e)
    );
    return () => unsub();
  }, [canManageHouseholdSettings, householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribePackingLists(
      householdId,
      (state) => {
        setPackingListsState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites });
        setSourceError("packingLists", null);
      },
      (e) => setSourceError("packingLists", e)
    );
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeActivity(
      householdId,
      50,
      (state) => {
        setActivityState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites });
        setSourceError("activity", null);
      },
      (e) => setSourceError("activity", e)
    );
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId || !canManageHouseholdSettings) {
      setLlmConfig(null);
      setLlmConfigMeta({ fromCache: true, hasPendingWrites: false });
      setSourceError("llmConfig", null);
      return;
    }
    const unsub = inventoryRepository.subscribeLlmConfig(
      householdId,
      (config, meta) => {
        setLlmConfig(config);
        setLlmConfigMeta(meta);
        setSourceError("llmConfig", null);
      },
      (e) => setSourceError("llmConfig", e)
    );
    return () => unsub();
  }, [canManageHouseholdSettings, householdId]);

  const error = useMemo(() => {
    const order: WorkspaceErrorSource[] = ["household", "spaces", "areas", "items", "itemDrafts", "members", "invites", "llmConfig", "packingLists", "activity"];
    return order.map((source) => errorsBySource[source]).find(Boolean) ?? null;
  }, [errorsBySource]);

  const spacesWithAreas: SpaceWithAreas[] = useMemo(() => {
    return spacesState.items
      .slice()
      .sort(byPosition)
      .map((space) => ({
        ...space,
        areas: areasState.items
          .filter((area) => area.spaceId === space.id)
          .slice()
          .sort(byPosition)
      }));
  }, [spacesState.items, areasState.items]);

  const sync = useMemo(
    () => ({
      fromCache:
        spacesState.fromCache ||
        areasState.fromCache ||
        itemsState.fromCache ||
        itemDraftsState.fromCache ||
        membersState.fromCache ||
        invitesState.fromCache ||
        packingListsState.fromCache ||
        activityState.fromCache ||
        llmConfigMeta.fromCache,
      hasPendingWrites:
        spacesState.hasPendingWrites ||
        areasState.hasPendingWrites ||
        itemsState.hasPendingWrites ||
        itemDraftsState.hasPendingWrites ||
        membersState.hasPendingWrites ||
        invitesState.hasPendingWrites ||
        packingListsState.hasPendingWrites ||
        activityState.hasPendingWrites ||
        llmConfigMeta.hasPendingWrites
    }),
    [activityState, areasState, invitesState, itemDraftsState, itemsState, llmConfigMeta, membersState, packingListsState, spacesState]
  );

  const actions: WorkspaceActions = useMemo(
    () => ({
      createSpaceId: inventoryRepository.createSpaceId,
      createAreaId: inventoryRepository.createAreaId,
      createItemId: inventoryRepository.createItemId,
      createItemDraftId: inventoryRepository.createItemDraftId,
      updateHousehold: inventoryRepository.updateHousehold,
      createSpace: inventoryRepository.createSpace,
      createArea: inventoryRepository.createArea,
      updateSpace: inventoryRepository.updateSpace,
      updateArea: inventoryRepository.updateArea,
      deleteSpace: inventoryRepository.deleteSpace,
      deleteArea: inventoryRepository.deleteArea,
      reorderSpaces: inventoryRepository.reorderSpaces,
      reorderAreas: inventoryRepository.reorderAreas,
      createItem: inventoryRepository.createItem,
      createItemsBatch: inventoryRepository.createItemsBatch,
      updateItem: inventoryRepository.updateItem,
      togglePacked: inventoryRepository.togglePacked,
      deleteItem: inventoryRepository.deleteItem,
      createItemDraft: inventoryRepository.createItemDraft,
      updateItemDraft: inventoryRepository.updateItemDraft,
      completeItemDraft: inventoryRepository.completeItemDraft,
      deleteItemDraft: inventoryRepository.deleteItemDraft,
      updateMemberRole: inventoryRepository.updateMemberRole,
      removeMember: inventoryRepository.removeMember,
      revokeInvite: inventoryRepository.revokeInvite,
      createPackingList: inventoryRepository.createPackingList,
      updatePackingList: inventoryRepository.updatePackingList,
      deletePackingList: inventoryRepository.deletePackingList,
      togglePackingListItem: inventoryRepository.togglePackingListItem,
      clearPackingListPacked: inventoryRepository.clearPackingListPacked,
      logActivity: inventoryRepository.logActivity,
      setItemStatus: inventoryRepository.setItemStatus,
      setItemLoan: inventoryRepository.setItemLoan,
      clearItemLoan: inventoryRepository.clearItemLoan
    }),
    []
  );

  return {
    household,
    spaces: spacesWithAreas,
    areas: areasState.items,
    items: itemsState.items,
    itemDrafts: itemDraftsState.items,
    members: membersState.items,
    invites: invitesState.items,
    packingLists: packingListsState.items,
    activity: activityState.items,
    llmConfig,
    sync,
    error,
    errorsBySource,
    userId: user?.uid ?? null,
    actions
  };
}
