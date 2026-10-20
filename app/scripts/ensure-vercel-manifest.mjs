import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Clean up any stale parent artifacts and bloated webpack caches from restored Vercel build caches
const parentNextDir = join(process.cwd(), '..', '.next');
const parentNodeModules = join(process.cwd(), '..', 'node_modules');
const parentPackageJson = join(process.cwd(), '..', 'package.json');
const webpackCache = join(process.cwd(), '.next', 'cache', 'webpack');

for (const stalePath of [parentNextDir, parentNodeModules, parentPackageJson, webpackCache]) {
  try {
    if (existsSync(stalePath)) {
      rmSync(stalePath, { recursive: true, force: true });
      console.log(`[clean] Purged stale artifact: ${stalePath}`);
    }
  } catch {}
}

const nextDir = join(process.cwd(), '.next');
const routesManifest = join(nextDir, 'routes-manifest.json');
const deterministicRoutesManifest = join(nextDir, 'routes-manifest-deterministic.json');

// Ensure deterministic routes manifest exists in local .next if present
if (existsSync(routesManifest) && !existsSync(deterministicRoutesManifest)) {
  copyFileSync(routesManifest, deterministicRoutesManifest);
  console.log('[postbuild] Created routes-manifest-deterministic.json');
}
