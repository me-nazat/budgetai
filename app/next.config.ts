import type { NextConfig } from "next";

const securityHeaders = [
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "connect-src 'self' https://*.turso.io https://generativelanguage.googleapis.com https://openrouter.ai https://open.er-api.com https://www.googleapis.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests",
        ].join('; '),
    },
    {
        key: 'X-Frame-Options',
        value: 'DENY',
    },
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
    },
    {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
    },
    {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
    },
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
    },
    {
        key: 'X-DNS-Prefetch-Control',
        value: 'off',
    },
];

const isVercel = process.env.VERCEL === '1';

const nextConfig: NextConfig = {
    outputFileTracingRoot: process.cwd(),
    poweredByHeader: false,
    productionBrowserSourceMaps: false,
    typescript: {
        ignoreBuildErrors: true,
    },
    ...(isVercel && {
        async headers() {
            return [
                {
                    source: '/(.*)',
                    headers: securityHeaders,
                },
            ];
        },
    }),
};

export default nextConfig;
