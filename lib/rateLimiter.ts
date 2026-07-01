interface Entry { count: number; windowStart: number }

declare global {
  // eslint-disable-next-line no-var
  var _rlStore: Map<string, Entry> | undefined;
}

const store: Map<string, Entry> =
  globalThis._rlStore ?? (globalThis._rlStore = new Map<string, Entry>());

/**
 * Sliding-window in-memory rate limiter.
 * key     — unique key (e.g. "otp:user@x.com", "signin:1.2.3.4")
 * max     — allowed requests per window
 * windowMs — window length in milliseconds
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();

  // Lazy prune — remove entries outside their window
  Array.from(store.entries()).forEach(([k, v]) => {
    if (now - v.windowStart > windowMs) store.delete(k);
  });

  const e = store.get(key);

  if (!e || now - e.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: max - 1, resetAt: now + windowMs };
  }

  if (e.count >= max) {
    return { ok: false, remaining: 0, resetAt: e.windowStart + windowMs };
  }

  e.count++;
  return { ok: true, remaining: max - e.count, resetAt: e.windowStart + windowMs };
}
