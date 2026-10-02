---
status: superseded by [0007](0007-maison-has-one-design-and-stays-on-npm.md)
---

# Maison draws two designs until the switch

While #29's redesign is built, Maison's element draws either today's design or the next one, chosen by the card's `design: next` config option, which `setConfig` reads. The next design is a second React tree, `NextApp`, over the same values `screen()` builds from the same snapshot. Guards (`guard.js`), commands, confirmation and the data loaders are shared, and so are their tests. A temporary storage dashboard, Maison Next, holds the same element with the option set, so both designs run on the household's phones while the pages are rebuilt. At #29 step 5 the next design becomes the only one, and today's tree, HeroUI and Maison Next are deleted. We chose this because each page can be reviewed on a real phone as it lands, without risking the dashboard the household uses every day, and because the values and their tests don't fork. The owner decided the approach on 29 September 2026 (#29's Approach). He decided the same day that the next design follows Home Assistant's light or dark theme, although the approved concept was drawn dark only.

## Considered options

- **Edit the current design in place, page by page.** Rejected: every intermediate state ships to the household, and today's reviewed baselines could guard nothing while the design they record is changing.
- **A separate dashboard with its own element or bundle.** Rejected: it means two releases to version and deploy, and the seam between them (snapshot, command, routing, Home Assistant's cards) would drift.
- **A separate branch until the redesign is done.** Rejected: there is no phone feedback while the pages are built, and the end is a big-bang merge.

## Consequences

- Two React trees exist until step 5: `App` (`frontend/maison/src/app.jsx`) and `NextApp` (`frontend/maison/src/next/app.jsx`). `mountDashboard` picks one by its `design` option. Until step 4 recomposes them, both draw the same page components (`src/pages.jsx`). A design change unmounts one tree and mounts the other on the same shadow root, as the same visit.
- Today's design stays pixel-locked: its reviewed baselines must keep matching while the next design is built. The next design has baselines of its own.
- The next design's CSS cannot reach today's. Its tokens are declared only on `:host([design="next"])`, which the element mirrors from the option. Every next selector starts with `.m-` or `:host([design="next"]`, and only `NextApp` and the next gallery inject those styles. `tests/maison-next.test.mjs` enforces it.
- HeroUI stays in the bundle until step 5. Today's tree needs it, and the next design draws today's page bodies inside its frame and sheets until step 4 replaces them. Maison's own controls are built on React Aria Components, which HeroUI already depends on, so the two share one React Aria.
- The next design has light and dark schemes, following the `dark` attribute the element sets from Home Assistant's theme. One constant (`THEMED` in `src/ui/tokens.js`) would make it dark-only.
- This is the new ADR that [ADR 0005](0005-maison-renders-only-with-react.md) asks for before a second renderer. ADR 0005 is otherwise unchanged. Both designs are React and draw only from values, neither is a fallback for the other, and Maison still has no HTML rendering.
- Creating Maison Next is a production change. It is created, and later deleted, only with the owner's go. It shares Maison's module resource, so every release reaches both dashboards.

## Closing note (1 October 2026)

The switch came with #29 step 5, as v36. The next design is Maison's only design: today's tree, HeroUI, Tailwind, Recharts and the `design` option are gone, and Maison Next is deleted after v36's deploy. [ADR 0007](0007-maison-has-one-design-and-stays-on-npm.md) records the switch and the decision to stay on npm. The text above stands as it was while the two designs ran.
