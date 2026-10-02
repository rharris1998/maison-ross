// maison-ross: folds config/www/maison into the one module HACS installs,
// dist/maison-ross.js. The served modules import each other with a ?v=
// stamp, which this strips so esbuild finds the files; the React bundle the
// element loads first is folded in too. Run from the repository root with
// esbuild installed (the release workflow uses frontend/maison's).
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const repo = fileURLToPath(new URL('../', import.meta.url));
const stripStamp = {
  name: 'strip-version-stamp',
  setup(b) {
    b.onResolve({filter: /\?v=\d+$/}, args => ({path: resolve(dirname(args.importer), args.path.replace(/\?v=\d+$/, ''))}));
  },
};

await build({
  entryPoints: [resolve(repo, 'config/www/maison/maison-dashboard.js')],
  outfile: resolve(repo, 'dist/maison-ross.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
  plugins: [stripStamp],
  logLevel: 'info',
});
