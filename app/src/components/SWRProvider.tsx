'use client';

import { SWRConfig } from 'swr';
import type { Cache, State } from 'swr';

const fetcher = (url: string) => fetch(url).then(r => {
    if (!r.ok) throw new Error('API error');
    return r.json();
});

const STORAGE_KEY = 'wealth-ai-swr-cache-v1';
const CACHE_TTL_MS = 30 * 60 * 1000;
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

export default function SWRProvider({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig value={{
            provider: createPersistentCache,
            fetcher,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            shouldRetryOnError: false,
            dedupingInterval: 10000,
            focusThrottleInterval: 60000,
            keepPreviousData: true,
            errorRetryCount: 2,
        }}>
            {children}
        </SWRConfig>
    );
}
