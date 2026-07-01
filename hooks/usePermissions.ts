import { useEffect, useState, useCallback } from 'react';

type Action = 'Add' | 'Edit' | 'View' | 'Delete';

interface Permissions {
  ready: boolean;
  failed: boolean;
  can: (module: string, action: Action) => boolean;
  refresh: () => Promise<void>;
}

// Module-level cache — shared across every component that calls usePermissions.
// This means only ONE fetch goes out no matter how many components are mounted.
let cachedMap: Record<string, Set<Action>> | null = null;
let cachedFailed = false;
let inFlight: Promise<void> | null = null;

async function fetchPermissions() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch('/api/my-permission');
      if (!res.ok) {
        cachedFailed = true;
        cachedMap = {};
        return;
      }
      const json: Record<string, string[]> = await res.json();
      const perms: Record<string, Set<Action>> = {};
      Object.entries(json).forEach(([mod, acts]) => {
        perms[mod] = new Set(acts as Action[]);
      });
      cachedMap = perms;
      cachedFailed = false;
    } catch {
      cachedFailed = true;
      cachedMap = {};
    }
  })();
  return inFlight;
}

export function usePermissions(): Permissions {
  const [map,    setMap]    = useState<Record<string, Set<Action>>>(cachedMap ?? {});
  const [ready,  setReady]  = useState(cachedMap !== null);
  const [failed, setFailed] = useState(cachedFailed);

  const applyCache = useCallback(() => {
    setMap(cachedMap ?? {});
    setFailed(cachedFailed);
    setReady(true);
  }, []);

  useEffect(() => {
    if (cachedMap !== null) {
      applyCache();
      return;
    }
    fetchPermissions().then(applyCache);
  }, [applyCache]);

  const refresh = useCallback(async () => {
    cachedMap = null;
    cachedFailed = false;
    inFlight = null;
    setReady(false);
    await fetchPermissions();
    applyCache();
  }, [applyCache]);

  const can = useCallback(
    (module: string, action: Action) => map[module]?.has(action) ?? false,
    [map],
  );

  return { ready, failed, can, refresh };
}
