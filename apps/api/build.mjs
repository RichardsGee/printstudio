// Bundle do api pra produção. Inclui workspace deps (@printstudio/db
// e @printstudio/shared) inline pra não precisar de packages/*/dist
// no runtime. Deps externas (fastify, drizzle, argon2, pino) ficam
// como require/import normal — instaladas via `pnpm install --prod`.
//
// Usado pelo Dockerfile no stage `build`. Em dev, `tsx watch` resolve
// os imports via main: ./src/index.ts dos packages, sem precisar de
// bundle.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Deps que ficam external — código fica em node_modules de prod, não
// é bundled. Inclui native modules (argon2 tem .node binary) e tudo
// que tá em `dependencies` do package.json (exceto @printstudio/*,
// que SÃO bundled inline).
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
  // Banner pra ESM resolver `import.meta.url` se algum código de
  // dependência precisar (drizzle-orm/postgres usam às vezes).
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
