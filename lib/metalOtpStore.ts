export interface OtpEntry {
  otp: string;
  expires: number; // epoch ms
  attempts: number;
  userId: number;
}

declare global {
  // eslint-disable-next-line no-var
  var _metalOtpStore: Map<string, OtpEntry> | undefined;
}

// globalThis pattern keeps the singleton across Next.js hot reloads in dev
const store: Map<string, OtpEntry> =
  globalThis._metalOtpStore ??
  (globalThis._metalOtpStore = new Map<string, OtpEntry>());

export default store;

export const OTP_TTL_MS     = 60_000; // 60 seconds
export const MAX_ATTEMPTS   = 3;

/** Remove all expired entries — call after every access */
export function pruneExpired() {
  const now = Date.now();
  Array.from(store.entries()).forEach(([k, v]) => {
    if (v.expires < now) store.delete(k);
  });
}
