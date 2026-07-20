import { describe, expect, it } from "vitest";
import { VISION_SETUP_MESSAGE, visionErrorMessage } from "./visionErrors";

describe("visionErrorMessage", () => {
  it("maps missing-config backend messages to the setup hint", () => {
    expect(visionErrorMessage(new Error("LLM config is not set"), "fallback")).toBe(VISION_SETUP_MESSAGE);
    expect(visionErrorMessage(new Error("LLM API key is not set"), "fallback")).toBe(VISION_SETUP_MESSAGE);
    expect(visionErrorMessage(new Error("Vision categorization is disabled for this household"), "fallback")).toBe(
      VISION_SETUP_MESSAGE
    );
    expect(visionErrorMessage(new Error("Shelf detection unsupported for this provider"), "fallback")).toBe(
      VISION_SETUP_MESSAGE
    );
  });

  it("passes through other provider messages verbatim", () => {
    expect(visionErrorMessage(new Error("Gemini API request failed (400)"), "fallback")).toBe(
      "Gemini API request failed (400)"
    );
  });

  it("falls back when the error carries no message", () => {
    expect(visionErrorMessage(new Error(""), "fallback")).toBe("fallback");
    expect(visionErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(visionErrorMessage("string error", "fallback")).toBe("fallback");
  });
});
