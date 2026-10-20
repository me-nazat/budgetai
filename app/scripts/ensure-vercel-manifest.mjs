import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd(); // /vercel/path0/app  (or local workspace/app)
const isVercel = Boolean(process.env.VERCEL);

// ── 1. PREBUILD: Purge stale parent artifacts from restored Vercel build caches
const staleArtifacts = [
  join(cwd, '..', 'node_modules'),
  join(cwd, '..', 'package.json'),
  join(cwd, '.next', 'cache', 'webpack'),
];

// Only delete the parent .next if on Vercel; locally keep it for dev speed
if (isVercel) {
  // Clean only stale sub-paths inside parent .next — do NOT delete the entire
  // directory so that Vercel's deployment tooling can still read from it.
  const parentNextCache = join(cwd, '..', '.next', 'cache');
  staleArtifacts.push(parentNextCache);
}

for (const stalePath of staleArtifacts) {
  try {
    if (existsSync(stalePath)) {
      rmSync(stalePath, { recursive: true, force: true });
      console.log(`[clean] Purged stale artifact: ${stalePath}`);
    }
  } catch {}
}

// ── 2. POST-BUILD: strip heavy paths from .nft.json traces
// Only runs when .next/server exists (i.e. after next build, not before)
const serverDir = join(cwd, '.next', 'server');
if (existsSync(serverDir)) {
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

// ── 3. POST-BUILD: Ensure deterministic routes manifests exist ───────────────
// Vercel's deploy tooling (during "Deploying outputs...") reads this file from
// TWO locations:
//   a) /vercel/path0/app/.next/   (the build directory)
//   b) /vercel/path0/.next/       (the repo root — Vercel reads routing here)
//
// We must write it to BOTH to prevent ENOENT during "Deploying outputs...".

const appNextDir = join(cwd, '.next');
const routesManifest = join(appNextDir, 'routes-manifest.json');

if (existsSync(routesManifest)) {
  // a) Write inside app/.next/ (existing behaviour)
  const appDeterministic = join(appNextDir, 'routes-manifest-deterministic.json');
  if (!existsSync(appDeterministic)) {
    copyFileSync(routesManifest, appDeterministic);
    console.log('[postbuild] Created app/.next/routes-manifest-deterministic.json');
  }

  // b) Write to PARENT .next/ so Vercel's deploy CLI can read it
  const parentNextDir = join(cwd, '..', '.next');
  try {
    mkdirSync(parentNextDir, { recursive: true });
    const parentDeterministic = join(parentNextDir, 'routes-manifest-deterministic.json');
    copyFileSync(routesManifest, parentDeterministic);
    console.log('[postbuild] Created parent .next/routes-manifest-deterministic.json');

    // Also copy the full routes-manifest.json to the parent so Vercel can
    // resolve all route patterns during the deploy phase.
    const parentRoutesManifest = join(parentNextDir, 'routes-manifest.json');
    copyFileSync(routesManifest, parentRoutesManifest);
    console.log('[postbuild] Created parent .next/routes-manifest.json');
  } catch (err) {
    console.warn('[postbuild] Could not write parent .next manifests:', err.message);
  }
}
