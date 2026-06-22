import { describe, expect, it, vi } from "vitest";
import { completeWrite } from "./completeWrite";

describe("completeWrite", () => {
  it("awaits the write and reports committed when online", async () => {
    await expect(completeWrite(Promise.resolve("id"), () => true)).resolves.toBe(true);
  });

  it("resolves immediately as not-committed when offline, even if the write never settles", async () => {
    const never = new Promise(() => {});
    await expect(completeWrite(never, () => false)).resolves.toBe(false);
  });

  it("swallows background rejection when offline (no unhandled rejection)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = Promise.reject(new Error("boom"));
    await expect(completeWrite(failing, () => false)).resolves.toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("propagates rejection when online", async () => {
    await expect(completeWrite(Promise.reject(new Error("boom")), () => true)).rejects.toThrow("boom");
  });

  it("notifies onQueuedWriteRejected when an offline write is later denied", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onRejected = vi.fn();
    const failing = Promise.reject(new Error("denied"));
    await expect(completeWrite(failing, () => false, onRejected)).resolves.toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onRejected).toHaveBeenCalledTimes(1);
    expect(onRejected.mock.calls[0][0]).toBeInstanceOf(Error);
    spy.mockRestore();
  });
});
