import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "img-src 'self' data: blob: https://maps.gstatic.com https://maps.googleapis.com https://*.googleusercontent.com https://*.ggpht.com",
            "connect-src 'self' https://*.turso.io https://generativelanguage.googleapis.com https://openrouter.ai https://open.er-api.com https://www.googleapis.com https://maps.googleapis.com https://maps.gstatic.com https://fonts.googleapis.com https://fonts.gstatic.com",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests",
        ].join('; '),
    },
    {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
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

const nextConfig: NextConfig = {
    // Scope NFT tracing to the app/ directory only.
    outputFileTracingRoot: path.join(__dirname),

    // Explicitly exclude heavy non-runtime paths from all NFT traces.
    // This prevents drizzle migrations, scripts, test files, .env files,
    // and binary artifacts from being bundled into any serverless Lambda.
    outputFileTracingExcludes: {
        '*': [
            '**/drizzle/**',
            '**/drizzle.config.*',
            '**/scripts/**',
            '**/__tests__/**',
            '**/coverage/**',
            '**/*.sqlite',
            '**/*.db',
            '**/*.log',
            '**/*.zip',
            '**/*.tar.gz',
            '**/playwright-report/**',
            '**/test-results/**',
            '**/tsconfig.tsbuildinfo',
            '**/vitest.config.*',
            '**/.env*',
            '**/*.md',
        ],
    },

    // Externalize ALL heavy server-only packages so they are NOT bundled into
    // each Lambda — resolved from node_modules at runtime instead.
    // This is the primary fix for the "Deploying outputs..." stall:
    // without this, each of the 129 API routes bundles googleapis (8MB+),
    // exceljs, jspdf etc. into its own isolated copy → 129 × 50MB = timeout.
    serverExternalPackages: [
        'googleapis',
        'exceljs',
        'jspdf',
        'jspdf-autotable',
    ],

    transpilePackages: [
        '@libsql/client',
        'drizzle-orm',
    ],

    poweredByHeader: false,
    compress: true,
    productionBrowserSourceMaps: false,
    typescript: {
        ignoreBuildErrors: true,
    },
    async redirects() {
        return [
            { source: '/coach', destination: '/chat', permanent: true },
            { source: '/overview', destination: '/dashboard', permanent: true },
            { source: '/my-month', destination: '/dashboard', permanent: true },
            { source: '/history', destination: '/transactions', permanent: true },
            { source: '/goals', destination: '/wealth-goals', permanent: true },
            { source: '/fire', destination: '/wealth-goals', permanent: true },
            { source: '/networth', destination: '/wealth-goals', permanent: true },
            { source: '/reports', destination: '/insights', permanent: true },
            { source: '/forecast', destination: '/insights', permanent: true },
            { source: '/analytics', destination: '/insights', permanent: true },
            { source: '/bill-split', destination: '/household', permanent: true },
        ];
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
