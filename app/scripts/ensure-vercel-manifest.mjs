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
  try {
    cpSync(nextDir, parentNextDir, { recursive: true });
    console.log('[postbuild] Copied .next to parent directory for Vercel');
    
    // Create symlinks so Next.js can find node_modules and package.json from the parent dir
    const parentNodeModules = join(process.cwd(), '..', 'node_modules');
    if (!existsSync(parentNodeModules)) {
      import('node:fs').then(fs => fs.symlinkSync(join(process.cwd(), 'node_modules'), parentNodeModules, 'dir'));
      console.log('[postbuild] Symlinked node_modules to parent directory');
    }
    
    const parentPackageJson = join(process.cwd(), '..', 'package.json');
    if (!existsSync(parentPackageJson)) {
      import('node:fs').then(fs => fs.symlinkSync(join(process.cwd(), 'package.json'), parentPackageJson, 'file'));
      console.log('[postbuild] Symlinked package.json to parent directory');
    }
  } catch (error) {
    console.error('[postbuild] Failed to set up Vercel root dir workaround:', error);
  }
}
