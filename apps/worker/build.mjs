// Bundle do worker pra produção. Mesmo padrão do api (apps/api/build.mjs).
// Workspace deps (@printstudio/*) inline; deps externas em node_modules.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const external = Object.keys(pkg.dependencies).filter(
  (dep) => !dep.startsWith('@printstudio/'),
);

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  external,
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
