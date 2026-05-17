import { copyFileSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const nextDir = join(process.cwd(), '.next');
const parentNextDir = join(process.cwd(), '..', '.next');
const routesManifest = join(nextDir, 'routes-manifest.json');
const deterministicRoutesManifest = join(nextDir, 'routes-manifest-deterministic.json');

// Step 1: Ensure deterministic routes manifest exists in local .next
if (existsSync(routesManifest) && !existsSync(deterministicRoutesManifest)) {
  copyFileSync(routesManifest, deterministicRoutesManifest);
  console.log('[postbuild] Created routes-manifest-deterministic.json');
}

// Step 2: Copy .next to parent directory for Vercel (repo root != app root)
if (existsSync(nextDir) && process.env.VERCEL) {
  cpSync(nextDir, parentNextDir, { recursive: true });
  console.log('[postbuild] Copied .next to parent directory for Vercel');
}
