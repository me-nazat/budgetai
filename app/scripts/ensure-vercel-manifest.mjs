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

// Note: We no longer copy .next to the parent directory.
// You must set "Root Directory" to "app" in your Vercel Project Settings.
