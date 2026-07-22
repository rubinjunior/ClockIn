const REDACTED = "[מוסתר]";

export function sanitizeDebugText(value: unknown, maxLength = 240) {
  const source = typeof value === "string" ? value : value instanceof Error ? value.message : String(value);
  const withoutQueries = source.replace(/(https?:\/\/[^\s?#]+)(?:\?[^\s#]*)?(?:#[^\s]*)?/gi, "$1");
  const withoutRelativeQueries = withoutQueries.replace(/(\/[^\s?#]+)\?[^\s#]*(?:#[^\s]*)?/g, "$1");
  const sanitized = withoutRelativeQueries
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/gi, REDACTED)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[מזהה]");
  return sanitized.length > maxLength ? `${sanitized.slice(0, maxLength - 1)}…` : sanitized;
}

export function safeRequestLabel(input: RequestInfo | URL) {
  try {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    return sanitizeDebugText(url.pathname);
  } catch {
    return "[נתיב לא זמין]";
  }
}
