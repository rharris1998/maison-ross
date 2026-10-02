// Builds dist/maison-ross.js, the file HACS installs, from src/ross-home.js:
// stamps the version and adds a header. No dependencies.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
const version = process.env.VERSION || 'dev';
const src = readFileSync(new URL('../src/ross-home.js', import.meta.url), 'utf8').replaceAll('__VERSION__', version);
mkdirSync(new URL('../dist/', import.meta.url), {recursive: true});
writeFileSync(new URL('../dist/maison-ross.js', import.meta.url), `/*! Ross Home ${version} · https://github.com/rharris1998/maison-ross */\n${src}`);
console.log(`dist/maison-ross.js ${version}`);
