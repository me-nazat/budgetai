/**
 * ensure-vercel-manifest.mjs
 *
 * Runs as both prebuild and postbuild.
 *
 * ROOT CAUSE of repeated Vercel "Deploying outputs..." ENOENT errors:
 *   Vercel's Root Directory is the repo root (/vercel/path0/), but Next.js
 *   builds inside app/ (/vercel/path0/app/). Vercel's deploy CLI reads ALL
 *   .next/ metadata from the ROOT-level .next/ directory, but next build only
 *   creates app/.next/. Each deploy attempt fails on a different missing file
 *   (routes-manifest.json, pages-manifest.json, build-manifest.json, etc.).
 *
 * DEFINITIVE FIX (postbuild):
 *   After next build completes, use cpSync to mirror the ENTIRE app/.next/
 *   directory to the parent .next/ directory. One copy, all files, no more
 *   whack-a-mole with individual missing manifests.
 */

import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd(); // /vercel/path0/app  OR  local workspace/app
const isVercel = Boolean(process.env.VERCEL);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1 — PREBUILD: Remove stale restored-cache artifacts
// ═══════════════════════════════════════════════════════════════════════════

const prebuildCleanTargets = [
  join(cwd, '..', 'node_modules'),       // stale root node_modules
  join(cwd, '..', 'package.json'),       // stale root package.json
  join(cwd, '.next', 'cache', 'webpack'),// bloated webpack cache in app/.next
];

// On Vercel, also wipe the stale parent .next/ so postbuild can write a
// clean, complete mirror without any cross-version stale artifacts.
if (isVercel) {
  prebuildCleanTargets.push(join(cwd, '..', '.next'));
}

for (const target of prebuildCleanTargets) {
  try {
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
      console.log(`[prebuild] Purged: ${target}`);
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 — POSTBUILD: Run only after next build has written app/.next/
// ═══════════════════════════════════════════════════════════════════════════

const appNextDir = join(cwd, '.next');
const serverDir  = join(appNextDir, 'server');

if (!existsSync(serverDir)) {
  // .next/server doesn't exist → this is a prebuild run; nothing more to do.
  process.exit(0);
}

// ── 2a. Strip heavy non-runtime paths from all .nft.json traces ───────────
// Prevents drizzle, scripts, .env files, etc. from being bundled into Lambdas.
const NFT_EXCLUDE = [
  '/drizzle/', '/drizzle.config.', '/scripts/', '/__tests__/',
  '/coverage/', '.sqlite', '.db', '.log', '.zip', '.tar.gz',
  '/playwright-report/', '/test-results/', '.tsbuildinfo',
  'vitest.config.', '/.env', '/node_modules/.cache/',
];

function stripNftDir(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      stripNftDir(full);
    } else if (entry.name.endsWith('.nft.json')) {
      try {
        const data = JSON.parse(readFileSync(full, 'utf8'));
        if (!Array.isArray(data.files)) continue;
        const before = data.files.length;
        data.files = data.files.filter((f) => !NFT_EXCLUDE.some((p) => f.includes(p)));
        if (data.files.length !== before) {
          writeFileSync(full, JSON.stringify(data));
          console.log(`[postbuild] NFT: stripped ${before - data.files.length} heavy paths from ${entry.name}`);
        }
      } catch {}
    }
  }
}

stripNftDir(serverDir);

// ── 2b. Mirror app/.next/ → parent .next/ for Vercel's deploy CLI ─────────
//
// Vercel's "Deploying outputs..." phase reads routing metadata, manifest
// files, and server chunks from /vercel/path0/.next/ (repo root). Since
// the build runs inside app/, we must copy the full directory so Vercel can
// find every file it needs without ENOENT errors.
//
// Affected files (non-exhaustive — this is why we copy everything):
//   routes-manifest.json, routes-manifest-deterministic.json,
//   server/pages-manifest.json, server/app-paths-manifest.json,
//   build-manifest.json, app-build-manifest.json,
//   prerender-manifest.json, server/middleware-manifest.json, ...

if (isVercel) {
  const parentNextDir = join(cwd, '..', '.next');
  try {
    cpSync(appNextDir, parentNextDir, { recursive: true, force: true });
    console.log('[postbuild] Synced app/.next → parent .next for Vercel deploy CLI');
  } catch (err) {
    console.warn('[postbuild] Warning: could not sync parent .next:', err.message);
  }
}
