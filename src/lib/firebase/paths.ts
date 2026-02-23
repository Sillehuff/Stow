export const householdPaths = {
  root: (householdId: string) => `households/${householdId}`,
  members: (householdId: string) => `households/${householdId}/members`,
  member: (householdId: string, uid: string) => `households/${householdId}/members/${uid}`,
  invites: (householdId: string) => `households/${householdId}/invites`,
  spaces: (householdId: string) => `households/${householdId}/spaces`,
  space: (householdId: string, spaceId: string) => `households/${householdId}/spaces/${spaceId}`,
  areas: (householdId: string, spaceId: string) => `households/${householdId}/spaces/${spaceId}/areas`,
  area: (householdId: string, spaceId: string, areaId: string) =>
    `households/${householdId}/spaces/${spaceId}/areas/${areaId}`,
  items: (householdId: string) => `households/${householdId}/items`,
  item: (householdId: string, itemId: string) => `households/${householdId}/items/${itemId}`,
  llmConfig: (householdId: string) => `households/${householdId}/settings/llm`
};

export const storagePaths = {
  draftImage: (householdId: string, draftId: string, fileName: string) =>
    `households/${householdId}/drafts/${draftId}/images/${fileName}`,
  itemImage: (householdId: string, itemId: string, fileName: string) =>
    `households/${householdId}/items/${itemId}/images/${fileName}`,
  spaceCover: (householdId: string, spaceId: string, fileName: string) =>
    `households/${householdId}/spaces/${spaceId}/cover/${fileName}`,
  areaCover: (householdId: string, areaId: string, fileName: string) =>
    `households/${householdId}/areas/${areaId}/cover/${fileName}`
};
