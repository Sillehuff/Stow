export function toUserErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const rawCode =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code.toLowerCase()
      : "";
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "";
  const message = raw.toLowerCase();

  if (!message) return fallback;

  if (
    rawCode.includes("permission-denied") ||
    message.includes("permission-denied") ||
    message.includes("permission denied") ||
    message.includes("no matching allow statements")
  ) {
    return "You don’t have permission to access that data. Try again, or ask a household owner to check access.";
  }

  if (message.includes("auth/operation-not-allowed")) {
    return "That sign-in method is not enabled for this project yet.";
  }

  if (rawCode.includes("network-request-failed") || rawCode === "functions/unavailable" || rawCode === "unavailable") {
    return "Network issue. Check your connection and try again.";
  }

  if (message.includes("network-request-failed") || message.includes("offline") || message.includes("failed to fetch")) {
    return "Network issue. Check your connection and try again.";
  }

  if (
    rawCode.includes("failed-precondition") ||
    message.includes("failed-precondition") ||
    message.includes("requires an index") ||
    message.includes("index") && message.includes("query")
  ) {
    return "This action needs a database config update. Please try again in a moment.";
  }

  if (message.includes("temporarily overloaded") || message.includes("high demand")) {
    return "The selected AI model is temporarily overloaded. Try again in a minute or switch to a more stable model.";
  }

  if (message.includes("quota is exhausted") || message.includes("quota exceeded")) {
    return "The configured AI provider is out of quota right now. Check the provider plan or try again later.";
  }

  return raw;
}

export function toLoggedUserErrorMessage(error: unknown, fallback?: string): string {
  if (import.meta.env.DEV && error) {
    console.error(error);
  }
  return toUserErrorMessage(error, fallback);
}
