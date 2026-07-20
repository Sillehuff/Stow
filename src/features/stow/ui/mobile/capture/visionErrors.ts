// Callable failures reach the UI carrying the backend's own message (functions.ts
// wraps unknown shapes via toUserErrorMessage). Configuration problems — no provider,
// no key, AI disabled — must point at Settings; showing "couldn't read the photo"
// for those sent users retrying a scan that can never succeed.
const CONFIG_PROBLEM =
  /llm config is not set|llm api key|vision categorization is disabled|shelf detection unsupported/i;

export const VISION_SETUP_MESSAGE =
  "AI Vision isn't set up yet — a household owner can add a provider and API key in Settings.";

export function visionErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.trim() : "";
  if (CONFIG_PROBLEM.test(raw)) return VISION_SETUP_MESSAGE;
  return raw || fallback;
}
