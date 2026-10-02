---
status: accepted
---

# Maison has one design and stays on npm

At #29 step 5 (v36), the design #29 rebuilt page by page on Maison Next becomes Maison's only design, and the two designs of [ADR 0006](0006-maison-draws-two-designs-until-the-switch.md) end; this record supersedes it. The old design's React tree and page components, HeroUI, Tailwind and Recharts are deleted, with the value fields only that tree drew, and the Maison Next dashboard is deleted after the deploy. The bundles hold React, React Aria and Maison's own code. The step also settles #29's open question: with HeroUI gone, should Maison and the wine cellar's frontend move to a pnpm workspace? They stay on npm, each with its own `package.json`, lockfile and `node_modules`. The two frontends share no code: the wine cellar draws HeroUI in 39 files and uses none of Maison's parts, and after the switch they share only 8 pinned packages, at identical versions. Maison still needs both of its build-time React Aria fixes, and pnpm's isolated `node_modules` breaks how `react-aria-compat.mjs` finds the module it patches. npm is already locked down (exact pins, `ignore-scripts=true`), and worktrees share `node_modules` through APFS clones. The owner decided both on 1 October 2026.

## Considered options

- **A pnpm workspace with a catalog and `pnpm patch`.** One lockfile, the shared pins in one catalog, Maison's controls as a local package, and `pnpm patch` in place of the build-time adapter. Rejected: it serves sharing the two frontends don't have. The wine cellar draws HeroUI in 39 files and uses none of Maison's parts, and the two share only 8 pinned packages, at identical versions. pnpm's isolated `node_modules` also makes `react-aria-compat.mjs` fail closed: React Aria is reached through a symlink, esbuild loads it by its real path, the adapter's path match never sees it, and the build throws rather than ship an unpatched bundle (checked in v36's review). Moving would mean rewriting both fixes as patches and proving both bundles byte for byte again.
- **pnpm later, on its own, without a workspace.** Not chosen: it would cost the same rework of the React Aria fixes, and npm already gives Maison exact pins, integrity hashes, no install scripts and cloned `node_modules` in worktrees.
- **Stay on npm.** Chosen. The build, its checks and `react-aria-compat.mjs` stay as they are.

## Consequences

- One React tree, `App` in `frontend/maison/src/app.jsx`, draws every page, sheet and dialog. The card's `design` option is gone: `setConfig` ignores a leftover `design` key of any value, so a stale `design: next` never breaks the card. Drawing a second design again needs a new ADR, as [ADR 0005](0005-maison-renders-only-with-react.md) asks of a second renderer.
- Maison's CSS is scoped to `:host` and `.m-` classes. What the pages took from HeroUI's sheet (Tailwind's preflight) and from `styles.js` until v36 is now Maison's own base, `@layer m-base` in `frontend/maison/src/frame.css.js`, which a test holds to exactly its rules. `styles.js` holds only the element's shell: the loading line and the Retry notice, in Maison's look ([ADR 0005](0005-maison-renders-only-with-react.md)).
- `build-app.mjs` fails when a package with bytes in a bundle has no licence shipped beside it, or a different licence text. `clsx`, which React Aria brings in, ships as `vendor/LICENSE.clsx.txt`.
- Both React Aria fixes stay in `react-aria-compat.mjs`, applied to both bundles and failing closed. They find their modules by path under `frontend/maison/node_modules`, so a symlinked `node_modules` fails the build too. A worktree gets an APFS clone of the main checkout's (`cp -c -R`), never a symlink.
- Maison and the wine cellar each keep their own `package.json`, lockfile, `.npmrc` and `node_modules`, and upgrade their pins on their own.
- Deleting Maison Next is a production change, made after v36's deploy with the owner's go, as ADR 0006 planned.
- Revisit when the wine cellar takes Maison's parts (its controls, tokens or sheet). Then a pnpm workspace, with those parts as a local package, has code to share. The move must keep both React Aria fixes applied and pass `npm run check` byte for byte.
