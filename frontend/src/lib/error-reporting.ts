export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  console.error("[App Error Capture]:", error, {
    route: typeof window !== "undefined" ? window.location.pathname : "SSR",
    ...context,
  });
}

