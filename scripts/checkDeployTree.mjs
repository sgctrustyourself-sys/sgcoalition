// Postbuild check for the SEO generator's output. The Vite closeBundle hook
// already guards the tree before this runs; this second caller catches anything
// the postbuild step itself might add and keeps `npm run build` honest after
// the generated route pages exist.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDeployTree } from '../utils/deployTreeGuard.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

assertDeployTree({
  outDir: path.join(projectRoot, 'dist'),
  publicDir: path.join(projectRoot, 'public'),
  projectRoot,
});

console.log('[deploy-tree-guard] dist contains only public assets and generated build output.');
