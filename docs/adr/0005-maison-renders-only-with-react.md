---
status: accepted
---

# Maison renders only with React; without its bundle it shows a notice and Retry

Maison's pages are drawn only by its React bundle, `vendor/maison-react.js`, which the custom element lazy-loads. While the bundle loads, Maison shows "Loading Maison…". If the import fails, Maison shows "Maison couldn't load. Reload to retry." with a Retry button, and no readings or controls. We chose this over keeping the element's own plain HTML rendering of the same pages as a fallback. That fallback arrived with the React mount in commit `3a353f3` (16 September 2026) as the older renderer, and no commit relies on it. Keeping it meant maintaining a second renderer: on 28 September 2026 the Today page, the drawer and dialogs, the toast, sensor search, the volume slider and the 24-hour chart each existed twice, and the Climate and Car builders branched on `ctx._react` to serve both. The owner decided this on 28 September 2026, as stage 1 of #27.

## Considered options

- **Keep the HTML fallback.** Rejected: it is a second renderer of every page. It drifts from the React one, nothing tests that the two agree, and the rules have to know which renderer consumes them.
- **A read-only HTML fallback, with readings but no controls.** Rejected: it is still a second renderer of every page's readings, and it drifts the same way.
- **A static notice that sends the user to Home Assistant, without Retry.** Rejected: a network fault can pass, and Retry recovers from it in place without reloading Home Assistant's whole frontend. The notice still says to reload, which covers the rest.

## Consequences

- A failed bundle load leaves Maison without readings or controls until Retry or a reload. Home Assistant's own UI still works.
- The bundle is served from the same origin as the element, so a failure means a broken deploy or a network fault.
- Retry imports the bundle again under a fresh URL, because a browser may keep a failed module import for the life of the page.
- `npm run check` fails when a committed bundle is stale. The Playwright touch suite's loading test blocks the bundle and checks the notice and Retry.
- The SVG 24-hour chart existed only for the fallback and is gone. Every 24-hour chart is the Recharts chart.
- Until stage 4 of #27 (v27), the element built most card markup as HTML, and React's Markup bridge (`frontend/maison/src/markup.jsx`) turned it into HeroUI controls. Stages 2–4 replaced those builders with values drawn by React components.
- Stage 4 of #27 (v27) deleted Markup and the last HTML builders, so React draws every page, the chrome and the dialogs from values.
- Adding a second renderer again needs a new ADR.

## Note (1 October 2026)

The 24-hour chart is Maison's own SVG chart (`frontend/maison/src/charts/history.jsx`), drawn in #29's redesign since v32. Since v36 that design is Maison's only one, so every 24-hour chart is that chart, and Recharts is gone. Since v36 the loading line and the Retry notice are drawn in Maison's own look by the element's shell (`config/www/maison/styles.js`), with the same words.
