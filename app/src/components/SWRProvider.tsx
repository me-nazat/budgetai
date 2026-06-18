'use client';

import { SWRConfig } from 'swr';
import type { Cache, State } from 'swr';

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
    let r = await fetch(url);

    // Auto-refresh on 401 — the access token may have expired
    if (r.status === 401) {
        const refreshed = await refreshTokens();
        if (refreshed) {
            // Retry the original request with new cookies
            r = await fetch(url);
        } else {
            // Refresh failed — redirect to login
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                localStorage.removeItem(STORAGE_KEY);
                window.location.href = '/login';
            }
            throw new Error('Session expired. Please log in again.');
        }
    }

    // Parse response once - avoid double consumption
    const json = await r.json().catch(() => ({}));

    if (!r.ok) {
        throw new Error(json?.error?.message || json?.error || 'API error');
    }

    // Transparently unwrap ApiSuccessResponse envelope
    return (json && typeof json === 'object' && json.success === true && 'data' in json) ? json.data : json;
};

const STORAGE_KEY = 'wealth-ai-swr-cache-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for instant loading on return visits
const PERSISTED_PREFIXES = [
    '/api/dashboard',
    '/api/transactions',
    '/api/categories',
    '/api/market',
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

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw) as Record<string, PersistedEntry>;
        const now = Date.now();

        return Object.entries(parsed)
            .filter(([key, entry]) => canPersistKey(key) && now - entry.updatedAt < CACHE_TTL_MS)
            .map(([key, entry]) => [key, entry.value] as const);
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return [];
    }
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

            for (const [key, value] of map.entries()) {
                if (!canPersistKey(key)) continue;

                const sanitized = sanitizeState(value);
                if (!sanitized) continue;

                payload[key] = {
                    value: sanitized,
                    updatedAt: now,
                };
            }

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
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

import { useEffect } from 'react';
import { mutate } from 'swr';

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Critical endpoints to pre-warm on authentication for instant dashboard loading. */
function getCriticalEndpoints() {
  const month = getCurrentMonthKey();
  return [
    '/api/auth/me',
    `/api/dashboard?month=${month}&week=all`,
    '/api/transactions?limit=50',
    '/api/categories',
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

/** Pre-warms the SWR cache with critical data for instant dashboard rendering. */
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

  // Check on initial load if user is authenticated
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        await warmCache();
      }
    } catch {
      // Ignore
    }
  };

  // Small delay to let SWR initialize first
  setTimeout(checkAuth, 100);
}

export default function SWRProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Run auto-sync for recurring transactions and subscriptions silently
        fetch('/api/sync', { method: 'POST' }).catch(() => {});

        // Set up authentication listener for cache warming
        setupAuthListener();
    }, []);

    return (
        <SWRConfig value={{
            provider: createPersistentCache,
            fetcher,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            shouldRetryOnError: false,
            dedupingInterval: 30000, // Increased to 30s to prevent rapid firing
            focusThrottleInterval: 120000, // Only refetch on focus every 2 mins max
            keepPreviousData: true,
            errorRetryCount: 1,
        }}>
            {children}
        </SWRConfig>
    );
}
