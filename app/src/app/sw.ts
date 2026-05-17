import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { CacheableResponsePlugin, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

const apiCache: RuntimeCaching[] = [
    {
        matcher: ({ sameOrigin, url, request }) =>
            sameOrigin &&
            request.method === "GET" &&
            url.pathname.startsWith("/api/") &&
            !url.pathname.startsWith("/api/auth"),
        handler: new NetworkFirst({
            cacheName: "wealth-ai-api-data",
            networkTimeoutSeconds: 2,
            plugins: [
                new CacheableResponsePlugin({ statuses: [0, 200] }),
                new ExpirationPlugin({
                    maxEntries: 80,
                    maxAgeSeconds: 30 * 60,
                    maxAgeFrom: "last-used",
                }),
            ],
        }),
    },
    {
        matcher: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
        handler: new StaleWhileRevalidate({
            cacheName: "wealth-ai-fonts",
            plugins: [
                new CacheableResponsePlugin({ statuses: [0, 200] }),
                new ExpirationPlugin({
                    maxEntries: 12,
                    maxAgeSeconds: 30 * 24 * 60 * 60,
                    maxAgeFrom: "last-used",
                }),
            ],
        }),
    },
];

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [...apiCache, ...defaultCache],
});

serwist.addEventListeners();
