// Builds dist/maison-ross.js, the one file HACS installs: bundles
// src/ross-home.js with the house view and three.js (vendored in vendor/three),
// stamps the version and puts the "Ross Home vX" header first, which the
// dashboard's self-update check reads.
import {build} from 'esbuild';
import {readFileSync, writeFileSync} from 'node:fs';
const version = process.env.VERSION || 'dev';
const root = new URL('../', import.meta.url).pathname;
const out = `${root}dist/maison-ross.js`;
await build({
  entryPoints: [`${root}src/ross-home.js`],
  outfile: out,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  alias: {three: `${root}vendor/three/three.module.min.js`},
  logLevel: 'warning',
});
const body = readFileSync(out, 'utf8').replaceAll('__VERSION__', version);
writeFileSync(out, `/*! Ross Home ${version} · https://github.com/rharris1998/maison-ross · includes three.js (MIT, three.js authors) */\n${body}`);
console.log(`dist/maison-ross.js ${version} ${(body.length / 1024).toFixed(0)} KB`);
