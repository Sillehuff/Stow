import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { StowApp } from "@/features/stow/ui/StowApp";
import type { Area, Household, HouseholdMember, Item, PackingList, SpaceWithAreas } from "@/types/domain";

const workspaceMock = vi.hoisted(() => ({
  useWorkspaceData: vi.fn()
}));

vi.mock("@/features/stow/hooks/useWorkspaceData", () => ({
  useWorkspaceData: workspaceMock.useWorkspaceData
}));

vi.mock("@/lib/firebase/storage", () => ({
  imageRefFromUrl: vi.fn(),
  uploadFileToStorage: vi.fn(),
  uploadImageUrlToStorage: vi.fn()
}));

const TIMESTAMP = {
  toDate: () => new Date("2026-04-19T12:00:00Z")
} as Item["updatedAt"];

const TEST_USER = {
  uid: "user-1",
  email: "owner@example.com"
} as User;

function createArea(id: string, spaceId: string, name: string, extra: Record<string, unknown> = {}): Area {
  return {
    id,
    householdId: "household-1",
    spaceId,
    name,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...extra
  } as Area;
}

function createSpace(id: string, name: string, areas: Area[], extra: Record<string, unknown> = {}): SpaceWithAreas {
  return {
    id,
    householdId: "household-1",
    name,
    icon: "box",
    color: "#4E7BFF",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    areas,
    ...extra
  } as SpaceWithAreas;
}

function createItem(id: string, spaceId: string, areaId: string, areaNameSnapshot: string, extra: Record<string, unknown> = {}): Item {
  return {
    id,
    householdId: "household-1",
    spaceId,
    areaId,
    areaNameSnapshot,
    name: `Item ${id}`,
    kind: "item",
    tags: [],
    notes: "",
    isPacked: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    createdBy: "user-1",
    updatedBy: "user-1",
    ...extra
  } as Item;
}

function createPackingList(
  id: string,
  name: string,
  itemIds: string[],
  packedItemIds: string[] = [],
  extra: Record<string, unknown> = {}
): PackingList {
  return {
    id,
    householdId: "household-1",
    name,
    itemIds,
    packedItemIds,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    createdBy: "user-1",
    updatedBy: "user-1",
    ...extra
  } as PackingList;
}

function buildWorkspace(
  overrides: Partial<Omit<ReturnType<typeof defaultWorkspace>, "actions">> & {
    actions?: Partial<ReturnType<typeof defaultWorkspace>["actions"]>;
  } = {}
) {
  const base = defaultWorkspace();
  return {
    ...base,
    ...overrides,
    actions: {
      ...base.actions,
      ...(overrides.actions ?? {})
    }
  };
}

function defaultWorkspace() {
  const garageShelf = createArea("area-1", "space-1", "Shelf");
  const officeDesk = createArea("area-2", "space-2", "Desk");
  const atticBin = createArea("area-3", "space-3", "Bin");
  const spaces = [
    createSpace("space-1", "Garage", [garageShelf]),
    createSpace("space-2", "Office", [officeDesk]),
    createSpace("space-3", "Attic", [atticBin])
  ];
  const areas = spaces.flatMap((space) => space.areas);
  const members: HouseholdMember[] = [
    {
      uid: "user-1",
      role: "OWNER",
      email: "owner@example.com",
      createdAt: TIMESTAMP,
      createdBy: "user-1"
    }
  ];
  const household: Household = {
    id: "household-1",
    name: "Launch House",
    createdAt: TIMESTAMP,
    createdBy: "user-1"
  };

  return {
    household,
    spaces,
    areas,
    items: [] as Item[],
    pendingDeletedItems: [] as Item[],
    members,
    invites: [],
    packingLists: [] as PackingList[],
    llmConfig: null,
    sync: { fromCache: false, hasPendingWrites: false },
    error: null,
    errorsBySource: {
      household: null,
      spaces: null,
      areas: null,
      items: null,
      members: null,
      invites: null,
      llmConfig: null,
      packingLists: null
    },
    userId: "user-1",
    actions: {
      updateHousehold: vi.fn(),
      createSpace: vi.fn(),
      createArea: vi.fn(),
      updateSpace: vi.fn(),
      updateArea: vi.fn(),
      deleteSpace: vi.fn().mockResolvedValue(undefined),
      deleteArea: vi.fn().mockResolvedValue(undefined),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      togglePacked: vi.fn(),
      deleteItem: vi.fn().mockResolvedValue(undefined),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
      revokeInvite: vi.fn(),
      createPackingList: vi.fn(),
      updatePackingList: vi.fn(),
      deletePackingList: vi.fn(),
      togglePackingListItem: vi.fn(),
      clearPackingListPacked: vi.fn()
    }
  };
}

function renderApp(route: string, workspace = defaultWorkspace()) {
  workspaceMock.useWorkspaceData.mockReturnValue(workspace);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="*" element={<StowApp householdId="household-1" user={TEST_USER} onSignOut={vi.fn()} online />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("StowApp delete recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  });

  it("finishes a locked area delete with its stored destination even when no items remain", async () => {
    const workspace = buildWorkspace({
      spaces: [
        createSpace(
          "space-1",
          "Garage",
          [createArea("area-1", "space-1", "Shelf", {
            deletingAt: TIMESTAMP,
            deleteTargetSpaceId: "space-2",
            deleteTargetAreaId: "area-2"
          })]
        ),
        createSpace("space-2", "Office", [createArea("area-2", "space-2", "Desk")])
      ],
      areas: [
        createArea("area-1", "space-1", "Shelf", {
          deletingAt: TIMESTAMP,
          deleteTargetSpaceId: "space-2",
          deleteTargetAreaId: "area-2"
        }),
        createArea("area-2", "space-2", "Desk")
      ]
    });

    renderApp("/spaces/space-1/areas/area-1?spaceView=items", workspace);

    await userEvent.click(screen.getAllByRole("button", { name: "Finish delete" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Finish deleting area" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Finish delete" }));

    await waitFor(() => {
      expect(workspace.actions.deleteArea).toHaveBeenCalledWith({
        householdId: "household-1",
        spaceId: "space-1",
        areaId: "area-1",
        userId: "user-1",
        reassignTo: {
          spaceId: "space-2",
          areaId: "area-2",
          areaNameSnapshot: "Desk"
        }
      });
    });
  });

  it("requires an explicit new destination when a locked area target is no longer valid", async () => {
    const lockedArea = createArea("area-1", "space-1", "Shelf", {
      deletingAt: TIMESTAMP,
      deleteTargetSpaceId: "space-2",
      deleteTargetAreaId: "area-locked"
    });
    const currentItem = createItem("item-1", "space-1", "area-1", "Shelf");
    const workspace = buildWorkspace({
      spaces: [
        createSpace("space-1", "Garage", [lockedArea]),
        createSpace("space-2", "Office", [createArea("area-locked", "space-2", "Locked Desk", { deletingAt: TIMESTAMP })]),
        createSpace("space-3", "Attic", [createArea("area-3", "space-3", "Bin")])
      ],
      areas: [
        lockedArea,
        createArea("area-locked", "space-2", "Locked Desk", { deletingAt: TIMESTAMP }),
        createArea("area-3", "space-3", "Bin")
      ],
      items: [currentItem]
    });

    renderApp("/spaces/space-1/areas/area-1?spaceView=items", workspace);

    await userEvent.click(screen.getAllByRole("button", { name: "Finish delete" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Finish deleting area" });
    const finishButton = within(dialog).getByRole("button", { name: "Finish delete" });
    const spaceSelect = within(dialog).getByLabelText("Move items to space");
    const areaSelect = within(dialog).getByLabelText("Move items to area");

    expect(spaceSelect).toHaveValue("");
    expect(areaSelect).toHaveValue("");
    expect(finishButton).toBeDisabled();
    expect(within(dialog).queryByRole("option", { name: "Office" })).not.toBeInTheDocument();

    await userEvent.selectOptions(spaceSelect, "space-3");
    await userEvent.selectOptions(areaSelect, "area-3");

    expect(finishButton).toBeEnabled();
  });

  it("shows every pending delete banner instead of truncating after three", () => {
    const workspace = buildWorkspace({
      pendingDeletedItems: [
        createItem("item-1", "space-1", "area-1", "Shelf", { deletedAt: TIMESTAMP, name: "Pending One" }),
        createItem("item-2", "space-1", "area-1", "Shelf", { deletedAt: TIMESTAMP, name: "Pending Two" }),
        createItem("item-3", "space-1", "area-1", "Shelf", { deletedAt: TIMESTAMP, name: "Pending Three" }),
        createItem("item-4", "space-1", "area-1", "Shelf", { deletedAt: TIMESTAMP, name: "Pending Four" })
      ]
    });

    renderApp("/spaces", workspace);

    expect(screen.getByText(/Pending One/)).toBeInTheDocument();
    expect(screen.getByText(/Pending Two/)).toBeInTheDocument();
    expect(screen.getByText(/Pending Three/)).toBeInTheDocument();
    expect(screen.getByText(/Pending Four/)).toBeInTheDocument();
  });

  it("restores focus to the edit-area trigger when delete is cancelled", async () => {
    const workspace = defaultWorkspace();
    renderApp("/spaces/space-1/areas/area-1?spaceView=items", workspace);

    const editButton = screen.getByRole("button", { name: "Edit area" });
    await userEvent.click(editButton);

    const editDialog = await screen.findByRole("dialog", { name: "Edit Area" });
    await userEvent.click(within(editDialog).getByRole("button", { name: "Delete Area" }));

    const deleteDialog = await screen.findByRole("dialog", { name: "Delete Area" });
    await userEvent.click(within(deleteDialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(editButton).toHaveFocus();
    });
  });

  it("uses a finish-delete action instead of edit controls for a locked space", async () => {
    const workspace = buildWorkspace({
      spaces: [
        createSpace("space-1", "Garage", [createArea("area-1", "space-1", "Shelf")], {
          deletingAt: TIMESTAMP,
          deleteTargetSpaceId: "space-2",
          deleteTargetAreaId: "area-2"
        }),
        createSpace("space-2", "Office", [createArea("area-2", "space-2", "Desk")])
      ],
      areas: [createArea("area-1", "space-1", "Shelf"), createArea("area-2", "space-2", "Desk")]
    });

    renderApp("/spaces/space-1", workspace);

    expect(screen.queryByRole("button", { name: "Edit space" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Finish deleting space" }));

    expect(await screen.findByRole("dialog", { name: "Finish deleting space" })).toBeInTheDocument();
  });

  it("uses a finish-delete action instead of edit controls for a locked area", async () => {
    const workspace = buildWorkspace({
      spaces: [
        createSpace("space-1", "Garage", [createArea("area-1", "space-1", "Shelf", {
          deletingAt: TIMESTAMP,
          deleteTargetSpaceId: "space-2",
          deleteTargetAreaId: "area-2"
        })]),
        createSpace("space-2", "Office", [createArea("area-2", "space-2", "Desk")])
      ],
      areas: [
        createArea("area-1", "space-1", "Shelf", {
          deletingAt: TIMESTAMP,
          deleteTargetSpaceId: "space-2",
          deleteTargetAreaId: "area-2"
        }),
        createArea("area-2", "space-2", "Desk")
      ]
    });

    renderApp("/spaces/space-1/areas/area-1?spaceView=items", workspace);

    expect(screen.queryByRole("button", { name: "Edit area" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Finish deleting area" }));

    expect(await screen.findByRole("dialog", { name: "Finish deleting area" })).toBeInTheDocument();
  });

  it("finishes a locked space delete with its stored destination even when no items remain", async () => {
    const workspace = buildWorkspace({
      spaces: [
        createSpace("space-1", "Garage", [createArea("area-1", "space-1", "Shelf")], {
          deletingAt: TIMESTAMP,
          deleteTargetSpaceId: "space-2",
          deleteTargetAreaId: "area-2"
        }),
        createSpace("space-2", "Office", [createArea("area-2", "space-2", "Desk")])
      ],
      areas: [createArea("area-1", "space-1", "Shelf"), createArea("area-2", "space-2", "Desk")]
    });

    renderApp("/spaces/space-1", workspace);

    await userEvent.click(screen.getAllByRole("button", { name: "Finish delete" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Finish deleting space" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Finish delete" }));

    await waitFor(() => {
      expect(workspace.actions.deleteSpace).toHaveBeenCalledWith({
        householdId: "household-1",
        spaceId: "space-1",
        userId: "user-1",
        reassignTo: {
          spaceId: "space-2",
          areaId: "area-2",
          areaNameSnapshot: "Desk"
        }
      });
    });
  });

  it("keeps packing list overview counts aligned with visible items during pending deletes", () => {
    const activeItem = createItem("item-1", "space-1", "area-1", "Shelf");
    const pendingItem = createItem("item-2", "space-1", "area-1", "Shelf", { deletedAt: TIMESTAMP });
    const workspace = buildWorkspace({
      items: [activeItem],
      pendingDeletedItems: [pendingItem],
      packingLists: [createPackingList("list-1", "Weekend Trip", ["item-1", "item-2"], ["item-1", "item-2"])]
    });

    renderApp("/packing", workspace);

    expect(screen.getByText("1 of 1 packed")).toBeInTheDocument();
    expect(screen.queryByText("2 of 2 packed")).not.toBeInTheDocument();
  });

  it("drops hidden pending-delete item ids when saving packing list membership", async () => {
    const activeItem = createItem("item-1", "space-1", "area-1", "Shelf");
    const pendingItem = createItem("item-2", "space-1", "area-1", "Shelf", { deletedAt: TIMESTAMP });
    const updatePackingList = vi.fn().mockResolvedValue(undefined);
    const workspace = buildWorkspace({
      items: [activeItem],
      pendingDeletedItems: [pendingItem],
      packingLists: [createPackingList("list-1", "Weekend Trip", ["item-1", "item-2"], ["item-1", "item-2"])],
      actions: {
        updatePackingList
      }
    });

    renderApp("/packing?listId=list-1", workspace);

    await userEvent.click(screen.getByRole("button", { name: /Add Items/i }));

    const dialog = await screen.findByRole("dialog", { name: "Select Items" });
    expect(within(dialog).getByText("1 selected")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    await waitFor(() => {
      expect(updatePackingList).toHaveBeenCalledWith({
        householdId: "household-1",
        listId: "list-1",
        userId: "user-1",
        patch: {
          itemIds: ["item-1"],
          packedItemIds: ["item-1"]
        }
      });
    });
  });
});
