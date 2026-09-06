import type { NextConfig } from "next";

const securityHeaders = [
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://va.vercel-scripts.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "img-src 'self' data: blob: https: https://maps.gstatic.com https://maps.googleapis.com https://*.googleusercontent.com https://*.ggpht.com",
            "connect-src 'self' https://*.turso.io https://generativelanguage.googleapis.com https://openrouter.ai https://open.er-api.com https://www.googleapis.com https://maps.googleapis.com https://maps.gstatic.com https://va.vercel-scripts.com https://vitals.vercel-insights.com",
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
        value: 'origin-when-cross-origin',
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
        value: 'on',
    },
];

const nextConfig: NextConfig = {
    reactStrictMode: true,
    
    // Image optimization
    images: {
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
        imageSizes: [16, 32, 48, 64, 96, 128, 256],
        minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
        dangerouslyAllowSVG: true,
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    },

    // Compression
    compress: true,

    // Experimental features for speed
    experimental: {
        optimizePackageImports: [
            'lucide-react',
            'recharts',
            'framer-motion',
            'date-fns',
            'material-symbols'
        ],
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },

    outputFileTracingRoot: process.cwd(),
    poweredByHeader: false,
    productionBrowserSourceMaps: false,
    // Headers for caching and security
    async headers() {
        return [
            {
                source: '/images/(.*)',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
            {
                source: '/(.*)',
                headers: securityHeaders,
            },
        ];
    },

    // Webpack optimization
    webpack(config, { dev, isServer }) {
        if (!dev && !isServer) {
            config.optimization = config.optimization || {};
            config.optimization.splitChunks = config.optimization.splitChunks || {};
            config.optimization.splitChunks.cacheGroups = {
                ...(config.optimization.splitChunks.cacheGroups || {}),
                recharts: {
                    test: /[\\/]node_modules[\\/]recharts[\\/]/,
                    name: 'recharts',
                    chunks: 'all',
                    priority: 20,
                },
                framer: {
                    test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
                    name: 'framer',
                    chunks: 'all',
                    priority: 20,
                },
            };
        }
        return config;
    },
    
    // Explicitly configure Turbopack
    turbopack: {},
};

export default nextConfig;
