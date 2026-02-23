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

export function useWorkspaceData(householdId: string | null, user: User | null) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [spacesState, setSpacesState] = useState<CollectionState<Space>>(emptyState());
  const [areasState, setAreasState] = useState<CollectionState<Area>>(emptyState());
  const [itemsState, setItemsState] = useState<CollectionState<Item>>(emptyState());
  const [membersState, setMembersState] = useState<CollectionState<HouseholdMember>>(emptyState());
  const [llmConfig, setLlmConfig] = useState<HouseholdLlmConfig | null>(null);
  const [llmConfigMeta, setLlmConfigMeta] = useState({ fromCache: true, hasPendingWrites: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeHousehold(householdId, setHousehold, (e) => setError(e.message));
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeSpaces(
      householdId,
      (state) => setSpacesState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites }),
      (e) => setError(e.message)
    );
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeAreas(
      householdId,
      (state) => setAreasState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites }),
      (e) => setError(e.message)
    );
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeItems(
      householdId,
      (state) => setItemsState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites }),
      (e) => setError(e.message)
    );
    return () => unsub();
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeMembers(
      householdId,
      (state) => setMembersState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites }),
      (e) => setError(e.message)
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
      },
      (e) => setError(e.message)
    );
    return () => unsub();
  }, [householdId]);

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
    userId: user?.uid ?? null,
    actions
  };
}
