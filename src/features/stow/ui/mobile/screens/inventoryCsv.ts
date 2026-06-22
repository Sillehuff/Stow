import type { Item, SpaceWithAreas } from "@/types/domain";

const HEADER = ["Name", "Space", "Area", "Tags", "Value", "Priceless", "Packed", "Notes"];

/** RFC-4180-ish: quote a field if it contains a comma, quote, CR, or LF; double internal quotes. */
function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Pure: serialize items to a CSV string. Space name resolved from the spaces list. */
export function buildInventoryCsv(items: Item[], spaces: SpaceWithAreas[]): string {
  const spaceNameById = new Map(spaces.map((space) => [space.id, space.name]));
  const rows = items.map((item) =>
    [
      item.name,
      spaceNameById.get(item.spaceId) ?? "",
      item.areaNameSnapshot ?? "",
      (item.tags ?? []).join(";"),
      item.value != null ? String(item.value) : "",
      item.isPriceless ? "Yes" : "No",
      // `status` is the live packed signal (set by the ItemDetail toggle); `isPacked` is dead.
      item.status === "packed" ? "Yes" : "No",
      item.notes ?? ""
    ]
      .map(csvCell)
      .join(",")
  );
  return [HEADER.join(","), ...rows].join("\n");
}

/** Browser side-effect: trigger a download of the CSV. Not unit-tested (DOM/anchor). */
export function downloadInventoryCsv(items: Item[], spaces: SpaceWithAreas[], fileName = "stow-inventory.csv"): void {
  const csv = buildInventoryCsv(items, spaces);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
