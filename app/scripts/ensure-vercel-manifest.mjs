import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const nextDir = join(process.cwd(), '.next');
const routesManifest = join(nextDir, 'routes-manifest.json');
const deterministicRoutesManifest = join(nextDir, 'routes-manifest-deterministic.json');

// Ensure deterministic routes manifest exists in local .next if present
if (existsSync(routesManifest) && !existsSync(deterministicRoutesManifest)) {
  copyFileSync(routesManifest, deterministicRoutesManifest);
  console.log('[postbuild] Created routes-manifest-deterministic.json');
}
