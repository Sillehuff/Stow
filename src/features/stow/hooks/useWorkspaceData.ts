import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { Area, Household, HouseholdMember, Item, Space, SpaceWithAreas } from "@/types/domain";
import type { HouseholdLlmConfig } from "@/types/llm";
import { inventoryRepository } from "@/features/stow/services/repository";

type CollectionState<T> = {
  items: T[];
  fromCache: boolean;
  hasPendingWrites: boolean;
};

function emptyState<T>(): CollectionState<T> {
  return { items: [], fromCache: true, hasPendingWrites: false };
}

export type WorkspaceActions = {
  createSpace: typeof inventoryRepository.createSpace;
  createArea: typeof inventoryRepository.createArea;
  updateSpace: typeof inventoryRepository.updateSpace;
  updateArea: typeof inventoryRepository.updateArea;
  createItem: typeof inventoryRepository.createItem;
  updateItem: typeof inventoryRepository.updateItem;
  togglePacked: typeof inventoryRepository.togglePacked;
  deleteItem: typeof inventoryRepository.deleteItem;
};

type WorkspaceErrorSource = "household" | "spaces" | "areas" | "items" | "members" | "llmConfig";
type WorkspaceErrorsBySource = Record<WorkspaceErrorSource, string | null>;

function emptyErrors(): WorkspaceErrorsBySource {
  return {
    household: null,
    spaces: null,
    areas: null,
    items: null,
    members: null,
    llmConfig: null
  };
}

export function useWorkspaceData(householdId: string | null, user: User | null) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [spacesState, setSpacesState] = useState<CollectionState<Space>>(emptyState());
  const [areasState, setAreasState] = useState<CollectionState<Area>>(emptyState());
  const [itemsState, setItemsState] = useState<CollectionState<Item>>(emptyState());
  const [membersState, setMembersState] = useState<CollectionState<HouseholdMember>>(emptyState());
  const [llmConfig, setLlmConfig] = useState<HouseholdLlmConfig | null>(null);
  const [llmConfigMeta, setLlmConfigMeta] = useState({ fromCache: true, hasPendingWrites: false });
  const [errorsBySource, setErrorsBySource] = useState<WorkspaceErrorsBySource>(emptyErrors());

  const setSourceError = (source: WorkspaceErrorSource, message: string | null) => {
    setErrorsBySource((prev) => (prev[source] === message ? prev : { ...prev, [source]: message }));
  };

  useEffect(() => {
    setHousehold(null);
    setSpacesState(emptyState());
    setAreasState(emptyState());
    setItemsState(emptyState());
    setMembersState(emptyState());
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
      (e) => setSourceError("household", e.message)
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
      (e) => setSourceError("spaces", e.message)
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
      (e) => setSourceError("areas", e.message)
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
      (e) => setSourceError("items", e.message)
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
      (e) => setSourceError("members", e.message)
    );
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeLlmConfig(
      householdId,
      (config, meta) => {
        setLlmConfig(config);
        setLlmConfigMeta(meta);
        setSourceError("llmConfig", null);
      },
      (e) => setSourceError("llmConfig", e.message)
    );
    return () => unsub();
  }, [householdId]);

  const error = useMemo(() => {
    const order: WorkspaceErrorSource[] = ["household", "spaces", "areas", "items", "members", "llmConfig"];
    return order.map((source) => errorsBySource[source]).find(Boolean) ?? null;
  }, [errorsBySource]);

  const spacesWithAreas: SpaceWithAreas[] = useMemo(() => {
    return spacesState.items.map((space) => ({
      ...space,
      areas: areasState.items
        .filter((area) => area.spaceId === space.id)
        .sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, [spacesState.items, areasState.items]);

  const sync = useMemo(
    () => ({
      fromCache:
        spacesState.fromCache || areasState.fromCache || itemsState.fromCache || membersState.fromCache || llmConfigMeta.fromCache,
      hasPendingWrites:
        spacesState.hasPendingWrites ||
        areasState.hasPendingWrites ||
        itemsState.hasPendingWrites ||
        membersState.hasPendingWrites ||
        llmConfigMeta.hasPendingWrites
    }),
    [areasState, itemsState, llmConfigMeta, membersState, spacesState]
  );

  const actions: WorkspaceActions = useMemo(
    () => ({
      createSpace: inventoryRepository.createSpace,
      createArea: inventoryRepository.createArea,
      updateSpace: inventoryRepository.updateSpace,
      updateArea: inventoryRepository.updateArea,
      createItem: inventoryRepository.createItem,
      updateItem: inventoryRepository.updateItem,
      togglePacked: inventoryRepository.togglePacked,
      deleteItem: inventoryRepository.deleteItem
    }),
    []
  );

  return {
    household,
    spaces: spacesWithAreas,
    areas: areasState.items,
    items: itemsState.items,
    members: membersState.items,
    llmConfig,
    sync,
    error,
    errorsBySource,
    userId: user?.uid ?? null,
    actions
  };
}
