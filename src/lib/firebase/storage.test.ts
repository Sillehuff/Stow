import { afterEach, describe, expect, it, vi } from "vitest";

const { deleteObjectMock, refMock } = vi.hoisted(() => ({
  deleteObjectMock: vi.fn(),
  refMock: vi.fn((_storage: unknown, path: string) => ({ fullPath: path }))
}));

vi.mock("firebase/storage", () => ({
  deleteObject: (...args: unknown[]) => deleteObjectMock(...args),
  ref: (...args: unknown[]) => refMock(...(args as [unknown, string])),
  // present so other imports in the module resolve if tree-shaking pulls them
  getDownloadURL: vi.fn(),
  uploadBytes: vi.fn()
}));

vi.mock("@/lib/firebase/client", () => ({
  getStorageClient: vi.fn(async () => ({ __storage: true }))
}));

import { bestEffortDeleteImage } from "@/lib/firebase/storage";

afterEach(() => {
  deleteObjectMock.mockReset();
  refMock.mockClear();
});

describe("bestEffortDeleteImage", () => {
  it("does nothing when image is null/undefined", async () => {
    await bestEffortDeleteImage(null);
    await bestEffortDeleteImage(undefined);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it("does nothing when the image has no storagePath", async () => {
    await bestEffortDeleteImage({ downloadUrl: "https://example.com/x.jpg" });
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it("deletes the object when a storagePath is present", async () => {
    deleteObjectMock.mockResolvedValueOnce(undefined);
    await bestEffortDeleteImage({ storagePath: "households/h1/items/i1/images/a.jpg" });
    expect(deleteObjectMock).toHaveBeenCalledTimes(1);
    expect(refMock).toHaveBeenCalledWith(expect.anything(), "households/h1/items/i1/images/a.jpg");
  });

  it("never throws when the underlying delete rejects", async () => {
    deleteObjectMock.mockRejectedValueOnce(new Error("not-found"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(
      bestEffortDeleteImage({ storagePath: "households/h1/items/i1/images/missing.jpg" })
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "bestEffortDeleteImage: failed to delete",
      "households/h1/items/i1/images/missing.jpg",
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });
});
