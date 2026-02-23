export function toUserErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
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
    message.includes("permission-denied") ||
    message.includes("permission denied") ||
    message.includes("no matching allow statements")
  ) {
    return "You don’t have permission to access that data. Try again, or ask a household owner to check access.";
  }

  if (message.includes("auth/operation-not-allowed")) {
    return "That sign-in method is not enabled for this project yet.";
  }

  if (
    message.includes("network-request-failed") ||
    message.includes("offline") ||
    message.includes("failed to fetch") ||
    message.includes("unavailable")
  ) {
    return "Network issue. Check your connection and try again.";
  }

  if (
    message.includes("failed-precondition") ||
    message.includes("requires an index") ||
    message.includes("index") && message.includes("query")
  ) {
    return "This action needs a database config update. Please try again in a moment.";
  }

  return raw;
}

export function toLoggedUserErrorMessage(error: unknown, fallback?: string): string {
  if (import.meta.env.DEV && error) {
    console.error(error);
  }
  return toUserErrorMessage(error, fallback);
}
