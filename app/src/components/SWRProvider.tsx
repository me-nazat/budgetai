'use client';

import { SWRConfig, mutate as globalMutate } from 'swr';
import type { Cache, State } from 'swr';
import { useEffect } from 'react';
import { mutate } from 'swr';

/** Track whether a token refresh is in-flight to prevent parallel refreshes. */
let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempts to refresh the auth tokens.
 * De-duplicates concurrent refresh requests.
 */
async function refreshTokens(): Promise<boolean> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            const res = await fetch('/api/auth/refresh', { method: 'POST' });
            const success = res.ok;
            if (success) {
              // Signal successful authentication for cache warming
              if (typeof window !== 'undefined') {
                localStorage.setItem('wealth-ai-auth-state', 'authenticated');
                window.dispatchEvent(new StorageEvent('storage', {
                  key: 'wealth-ai-auth-state',
                  newValue: 'authenticated',
                }));
              }
            }
            return success;
        } catch {
            return false;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

const fetcher = async (url: string) => {
    const isPrivacy = typeof window !== 'undefined' && sessionStorage.getItem('privacyMode') === 'true';
    // Only send X-Privacy-Mode for account-related routes that mask sensitive account numbers.
    const isSensitiveAccountPath = url.startsWith('/api/accounts') || url.startsWith('/api/bank-import');
    const reqHeaders: Record<string, string> = (isPrivacy && isSensitiveAccountPath) ? { 'X-Privacy-Mode': '1' } : {};
    let r = await fetch(url, { headers: reqHeaders });

    // Auto-refresh on 401 — the access token may have expired
    if (r.status === 401) {
        const refreshed = await refreshTokens();
        if (refreshed) {
            // Retry the original request with refreshed cookies
            r = await fetch(url, { headers: reqHeaders });
        } else {
            // Refresh failed — redirect to login
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                localStorage.removeItem(STORAGE_KEY);
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
                window.location.href = '/login';
            }
            throw new Error('Session expired. Please log in again.');
        }
    }

    const json = await r.json().catch(() => ({}));

    if (!r.ok) {
        const error = new Error(json?.error?.message || json?.error || 'API error') as Error & { status?: number };
        error.status = r.status;
        throw error;
    }

    // Transparently unwrap ApiSuccessResponse envelope
    return (json && typeof json === 'object' && json.success === true && 'data' in json) ? json.data : json;
};

const STORAGE_KEY = 'wealth-ai-swr-cache-v3';
const SESSION_STORAGE_KEY = 'wealth-ai-core-meta-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for instant loading on return visits

/** Core read endpoints that hydrate rapidly on hard reload via sessionStorage fallback */
const CORE_READ_PREFIXES = [
    '/api/accounts',
    '/api/categories',
    '/api/settings',
];

const PERSISTED_PREFIXES = [
    '/api/accounts',
    '/api/categories',
    '/api/settings',
    '/api/dashboard',
    '/api/transactions',
    '/api/budgets',
    '/api/networth',
    '/api/goals',
    '/api/recurring',
    '/api/notifications',
    '/api/bill-splits',
];

type PersistedEntry = {
    value: State<unknown, Error>;
    updatedAt: number;
};

function canPersistKey(key: string) {
    return PERSISTED_PREFIXES.some(prefix => key.startsWith(prefix));
}

function readPersistentEntries() {
    if (typeof window === 'undefined') return [];

    const entriesMap = new Map<string, State<unknown, Error>>();

    // 1. First check bounded sessionStorage fallback for instant core metadata
    try {
        const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (rawSession) {
            const parsedSession = JSON.parse(rawSession) as Record<string, PersistedEntry>;
            for (const [key, entry] of Object.entries(parsedSession)) {
                if (CORE_READ_PREFIXES.some(prefix => key.startsWith(prefix))) {
                    entriesMap.set(key, entry.value);
                }
            }
        }
    } catch {
        // Ignore session storage error
    }

    // 2. Read persisted localStorage entries
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Record<string, PersistedEntry>;
            const now = Date.now();

            for (const [key, entry] of Object.entries(parsed)) {
                if (!canPersistKey(key) || now - entry.updatedAt >= CACHE_TTL_MS) {
                    continue;
                }
                const data = entry.value?.data as any;
                if (key.startsWith('/api/transactions') && data?.transactions && Array.isArray(data.transactions) && data.transactions.length > 0) {
                    const allZero = data.transactions.every((t: any) => t.amount === 0);
                    if (allZero) continue;
                }
                entriesMap.set(key, entry.value);
            }
        }
    } catch {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {}
    }

    return Array.from(entriesMap.entries());
}

function sanitizeState(value: unknown): State<unknown, Error> | null {
    if (!value || typeof value !== 'object') return null;

    const state = value as State<unknown, Error>;
    if (state.data === undefined) return null;

    return {
        data: state.data,
        error: undefined,
        isLoading: false,
        isValidating: false,
    };
}

function createPersistentCache(): Cache<unknown> {
    const map = new Map<string, State<unknown, Error>>(readPersistentEntries());
    let timer: ReturnType<typeof setTimeout> | null = null;

    const persist = () => {
        if (typeof window === 'undefined') return;
        if (timer) clearTimeout(timer);

        timer = setTimeout(() => {
            const now = Date.now();
            const payload: Record<string, PersistedEntry> = {};
            const sessionPayload: Record<string, PersistedEntry> = {};

            for (const [key, value] of map.entries()) {
                if (!canPersistKey(key)) continue;

                const sanitized = sanitizeState(value);
                if (!sanitized) continue;

                const entry: PersistedEntry = {
                    value: sanitized,
                    updatedAt: now,
                };

                payload[key] = entry;

                // Also populate bounded sessionStorage fallback for core read endpoints
                if (CORE_READ_PREFIXES.some(prefix => key.startsWith(prefix))) {
                    sessionPayload[key] = entry;
                }
            }

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            } catch {
                try {
                    localStorage.removeItem(STORAGE_KEY);
                } catch {}
            }

            try {
                sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionPayload));
            } catch {}
        }, 250);
    };

    return {
        get: key => map.get(key),
        set: (key, value) => {
            map.set(key, value as State<unknown, Error>);
            if (canPersistKey(key)) persist();
        },
        delete: key => {
            map.delete(key);
            if (canPersistKey(key)) persist();
        },
        keys: () => map.keys(),
    };
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Critical endpoints to pre-warm on authentication for instant dashboard and accounts loading. */
function getCriticalEndpoints() {
  const month = getCurrentMonthKey();
  return [
    '/api/auth/me',
    `/api/dashboard?month=${month}&week=all`,
    '/api/transactions?limit=50',
    '/api/accounts',
    '/api/categories',
    '/api/settings',
    '/api/budgets',
    '/api/networth',
  ];
}

function unwrapApiResponse(json: unknown) {
  if (json && typeof json === 'object' && (json as { success?: boolean }).success === true && 'data' in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

/** Pre-warms the SWR cache with critical data for instant rendering. */
async function warmCache() {
  try {
    await Promise.allSettled(
      getCriticalEndpoints().map(async (endpoint) => {
        const response = await fetch(endpoint, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (response.ok) {
          const json = await response.json().catch(() => null);
          if (json) {
            await mutate(endpoint, unwrapApiResponse(json), false);
          }
        }
      })
    );
  } catch {
    // Silently fail - cache warming is best effort
  }
}

/** Listens for authentication state changes and triggers cache warming. */
function setupAuthListener() {
  if (typeof window === 'undefined') return;

  // Listen for storage events (cross-tab login)
  window.addEventListener('storage', (e) => {
    if (e.key === 'wealth-ai-auth-state' && e.newValue === 'authenticated') {
      warmCache();
    }
  });

  // Listen for custom auth event (same-tab login)
  window.addEventListener('wealth-ai-authenticated', () => {
    warmCache();
  });
}

export default function SWRProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Run auto-sync for recurring transactions throttled to at most once per 15 minutes
        const lastSync = sessionStorage.getItem('wealth-ai-last-sync');
        const now = Date.now();
        if (!lastSync || now - Number(lastSync) > 15 * 60 * 1000) {
            sessionStorage.setItem('wealth-ai-last-sync', String(now));
            fetch('/api/sync', { method: 'POST' }).catch(() => {});
        }

        // Set up authentication listener for cache warming
        setupAuthListener();

        // Listen for privacy mode toggle to revalidate active queries with/without X-Privacy-Mode
        const handlePrivacyChange = () => {
            globalMutate(() => true);
        };
        window.addEventListener('privacy-mode-change', handlePrivacyChange);
        return () => window.removeEventListener('privacy-mode-change', handlePrivacyChange);
    }, []);

    return (
        <SWRConfig value={{
            provider: createPersistentCache,
            fetcher,
            revalidateOnFocus: false,
            revalidateIfStale: true,
            revalidateOnReconnect: true,
            dedupingInterval: 8000, // 8-second deduplication prevents request storms
            keepPreviousData: true, // Prevents blank flash on filter/parameter changes
            errorRetryCount: 2, // 2 retries with exponential backoff
            onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
                // Never retry on 401, 403, or 404
                if (error?.status === 401 || error?.status === 403 || error?.status === 404) return;
                // Maximum 2 retries
                if (retryCount >= 2) return;
                // Exponential backoff: 1s, 2s (capped at 4s)
                const delay = Math.min(1000 * Math.pow(2, retryCount), 4000);
                setTimeout(() => revalidate({ retryCount }), delay);
            },
        }}>
            {children}
        </SWRConfig>
    );
}
