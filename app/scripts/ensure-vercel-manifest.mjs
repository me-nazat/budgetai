import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();

// ── 1. Purge stale parent artifacts from restored Vercel build caches ──────
const staleArtifacts = [
  join(cwd, '..', '.next'),
  join(cwd, '..', 'node_modules'),
  join(cwd, '..', 'package.json'),
  join(cwd, '.next', 'cache', 'webpack'),
];

for (const stalePath of staleArtifacts) {
  try {
    if (existsSync(stalePath)) {
      rmSync(stalePath, { recursive: true, force: true });
      console.log(`[clean] Purged stale artifact: ${stalePath}`);
    }
  } catch {}
}

// ── 2. Post-build: strip heavy paths from .nft.json traces ────────────────
// Only runs when .next/server exists (i.e. after build, not before)
const serverDir = join(cwd, '.next', 'server');
if (existsSync(serverDir)) {
  // Patterns that must never appear in any Lambda's NFT trace
  const EXCLUDE_PATTERNS = [
    '/drizzle/',
    '/drizzle.config.',
    '/scripts/',
    '/__tests__/',
    '/coverage/',
    '.sqlite',
    '.db',
    '.log',
    '.zip',
    '.tar.gz',
    '/playwright-report/',
    '/test-results/',
    '.tsbuildinfo',
    'vitest.config.',
    '/.env',
    '.md',
    '/node_modules/.cache/',
  ];

  function shouldExclude(p) {
    return EXCLUDE_PATTERNS.some((pat) => p.includes(pat));
  }

  function processNftDir(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        processNftDir(full);
      } else if (entry.name.endsWith('.nft.json')) {
        try {
          const raw = readFileSync(full, 'utf8');
          const data = JSON.parse(raw);
          if (!Array.isArray(data.files)) continue;
          const before = data.files.length;
          data.files = data.files.filter((f) => !shouldExclude(f));
          if (data.files.length !== before) {
            writeFileSync(full, JSON.stringify(data));
            console.log(`[nft] Stripped ${before - data.files.length} heavy paths from ${entry.name}`);
          }
        } catch {}
      }
    }
  }

  processNftDir(serverDir);
}

// ── 3. Ensure deterministic routes manifest ───────────────────────────────
const nextDir = join(cwd, '.next');
const routesManifest = join(nextDir, 'routes-manifest.json');
const deterministicRoutesManifest = join(nextDir, 'routes-manifest-deterministic.json');

if (existsSync(routesManifest) && !existsSync(deterministicRoutesManifest)) {
  copyFileSync(routesManifest, deterministicRoutesManifest);
  console.log('[postbuild] Created routes-manifest-deterministic.json');
}
