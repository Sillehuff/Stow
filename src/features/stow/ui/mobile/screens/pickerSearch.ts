export function normalizePackingItemPickerQuery(query: string) {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

export function matchesPackingItemPickerQuery(query: string, fields: string[]) {
  const normalizedQuery = normalizePackingItemPickerQuery(query);
  if (!normalizedQuery) return true;

  return fields.some((field) => normalizePackingItemPickerQuery(field).includes(normalizedQuery));
}
