import { describe, expect, it } from "vitest";
import { defaultEntryMode, defaultPhotoStatus } from "@/features/stow/services/itemMetadata";

describe("item capture metadata defaults", () => {
  it("preserves explicit photo statuses", () => {
    expect(defaultPhotoStatus({ photoStatus: "skipped" })).toBe("skipped");
    expect(defaultPhotoStatus({ photoStatus: "later" })).toBe("later");
  });

  it("maps legacy image records to attached", () => {
    expect(defaultPhotoStatus({ image: { downloadUrl: "https://example.com/item.jpg" } })).toBe("attached");
    expect(defaultPhotoStatus({ image: { storagePath: "households/h1/items/i1/image.jpg" } })).toBe("attached");
  });

  it("maps legacy no-photo records to later", () => {
    expect(defaultPhotoStatus({ image: null })).toBe("later");
    expect(defaultPhotoStatus({})).toBe("later");
  });

  it("preserves explicit entry modes", () => {
    expect(defaultEntryMode({ entryMode: "photo_draft" })).toBe("photo_draft");
    expect(defaultEntryMode({ entryMode: "manual", vision: { confidence: 0.9 } })).toBe("manual");
  });

  it("maps legacy vision records to AI-assisted and other records to manual", () => {
    expect(defaultEntryMode({ vision: { confidence: 0.72 } })).toBe("ai_assisted");
    expect(defaultEntryMode({})).toBe("manual");
  });
});
