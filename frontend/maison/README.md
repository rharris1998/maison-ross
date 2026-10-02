# Maison dashboard frontend

This directory builds Maison's React interface for its Home Assistant custom
element. Maison draws one design, on its own controls over React Aria
Components ([ADR 0007](../../docs/adr/0007-maison-has-one-design-and-stays-on-npm.md)).
What the dashboard shows and does, how to preview it and how to deploy it are
in the [top-level README](../../README.md); this file covers
the build, vendored dependencies, shadow-DOM adapters, test suites and
licenses.

The generated production modules contain React 19.3.0, React DOM 19.3.0, React
Aria 3.52.1, React Aria Components 1.21.1 and React Stately 3.50.0, with the
small packages they bring (`scheduler`, `use-sync-external-store`, React
Aria's `@internationalized` packages and `clsx`). The dashboard has no CDN,
package-registry, font, or other runtime network dependency.

Until v36 (#29 step 5) Maison also drew an older design on HeroUI, with
Recharts for its charts
([ADR 0006](../../docs/adr/0006-maison-draws-two-designs-until-the-switch.md)).
Both left with that design, along with Tailwind and the card's `design`
option.

## How the pieces fit

`config/www/maison/maison-dashboard.js` is the custom element. It owns Home
Assistant state, routing, service dispatch, history and calendar requests,
and Home Assistant's own cards. It lazy-loads `vendor/maison-react.js` and
mounts it:

```js
const app = mountDashboard(root, {shadowRoot, command, attachNative});
app.update(screen);   // on every render, screen(snapshot()) from the served screen.js
app.toast(message);   // a short notice, such as a request that failed
app.unmount();
```

React never reads the element; these are its only ways in and out.

- **`update(screen)`** draws a Screen, `{chrome, page, drawer, dialog}`,
  built from the element's `snapshot()`, which reads everything one render
  shows once. Every value is plain data built by the served rule modules
  (`screen.js`, per page `today.js`, `climate.js`, `car.js`, `energy.js`
  and `system.js`, and `sky.js` for the sky), with every phrase already
  formatted and every control's `enabled` and `feedback` already decided.
  The value shapes are the JSDoc typedefs in those modules. The chrome's
  `sky`, `line` and `hero` are the hero's.
- **`command(intent)`** is every press, as `{command, entity?, direction?,
  value?}`, with no fake DOM events. A press calls
  `command(control.intent)`; the Away date field, the sensor search and its
  category send `command({...intent, value})`. A write or draft (a command
  in `WRITE_COMMANDS`) goes through the served `guard.js`, the same rule
  that enables its control.
- **`attachNative(slot, key, config)`** fills the empty slot `src/native.jsx`
  draws for a Home Assistant card (the full calendar, a history graph).
  React never renders the slot's children; the element owns them. Every
  such slot is the only child of `div.m-native`, whose rules map Home
  Assistant's card variables onto Maison's tokens.
- **`shadowRoot`** is where the overlay portal goes.

The card's config has no `design` option any more: `setConfig` ignores a
leftover `design` key, of any value.

`src/app.jsx` holds `mountDashboard` and `App`. `App` draws the Screen inside
`Frame`, under its hero, and provides `CommandContext`, `PortalContext` and
`NativeContext`: the page from `PAGES` by `page.id`, the drawer's body in
the Sheet (`DrawerSheet`, from `DRAWERS` by the body's kind), the dialog's
(`DialogSheet`, from `DIALOGS` by its kind), and the toasts from the queue
`mountDashboard` builds with `createToastQueue()`. React composes no English
and decides no enablement.

`src/` holds renderers only. The synthetic states the gallery and the Node
tests share are in `fixtures/`.

React is Maison's only renderer
([ADR 0005](../../docs/adr/0005-maison-renders-only-with-react.md)). While the
bundle loads, the element shows "Loading Maison…" (`p.m-loading`). If the
import fails, it shows "Maison couldn’t load. Reload to retry."
(`div.m-notice`) with a Retry button, and no readings or controls. Retry
imports the bundle again under a fresh URL, because a browser may keep a
failed module import for the life of the page. That shell is the element's
own: `config/www/maison/styles.js` draws it in Maison's look, with Maison's
colours written out since its tokens arrive with the bundle. Its rules sit
in a layer of their own and set nothing that inherits, so once React mounts
the bundle's rules win.

Neither bundle embeds a rule module. `maison-react.js` receives values, so of
`config/www/maison/` it embeds only `icons.js`. The gallery also embeds the
fixtures, which bring `model.js`'s entity constants; `dev/maison/gallery.html`
imports the served `screen.js` and passes it in. A wording or rule change in
a served rule module therefore leaves both bundles byte-identical.
`tests/maison-bundles.test.mjs` fails when anything under `src/` imports a
served module other than `icons.js`. After editing `src/`, `fixtures/`,
`icons.js` or `model.js`'s constants, rebuild; `npm run check` fails while a
bundle is stale. `NAV`, `TITLES` and `PAGE_IDS` live once, in `screen.js`:
the chrome value carries the navigation and the page's title, and the
element routes by `PAGE_IDS`.

The generated browser assets are:

- `config/www/maison/vendor/maison-react.js`: the dashboard app exported as
  `mountDashboard`;
- `config/www/maison/vendor/maison-gallery.js`: the synthetic component gallery
  exported as `mountGallery(target, {theme, screen, view})`, used only by the
  local preview; `view: 'pages'` draws its pages view;
- `config/www/maison/icons.js`: the curated local Iconify subset;
- the license files beside the bundles (see
  [Provenance and licenses](#provenance-and-licenses)).

## Rebuild

From this directory:

```sh
npm ci
npm run build
npm run check
```

`npm run build` regenerates the icons and both React modules, and copies the
shipped licenses. `npm run check` rebuilds each artifact in a temporary
directory and fails when a committed bundle or license differs. The narrower
`build:icons`, `build:app` and matching `check:*` commands remain available.

`build-app.mjs` fails, in a build and in a check, when:

- a [React Aria fix](#react-aria-build-time-fixes) is not applied exactly
  once to a bundle;
- a bundle exports anything but its one entry (`mountDashboard` or
  `mountGallery`), as its metafile says, or imports a module at run time;
- a package with bytes in a bundle has no license shipped beside it, or its
  own license text differs from the shipped file's. The `licenses` list maps
  each package to one file: React's covers `react`, `react-dom`, `scheduler`
  and `use-sync-external-store`; React Aria's covers `react-aria`,
  `react-aria-components`, `react-stately` and `@internationalized/*`; and
  `clsx`'s covers `clsx`, which React Aria brings into both bundles. A new
  transitive dependency therefore fails the build until its license ships
  too.

Dependencies and their integrity hashes are pinned in `package-lock.json`.
Package lifecycle scripts are disabled (`.npmrc`) because this build only needs
published JavaScript artifacts. Maison stays on npm, with a lockfile of its
own beside the wine cellar's (`frontend/wine-cellar/`); ADR 0007 records why
a pnpm workspace was not chosen.


## React, portals, and shadow DOM

`src/app.jsx` is the production React entry and `src/gallery.jsx` is its
synthetic gallery; both import `src/shadow-dom.js` first. esbuild emits
minified, self-contained ES modules with no external imports. Maison's
controls use React Aria for interaction and focus behavior, and React Aria
must be told about Home Assistant's shadow root:

- `src/shadow-dom.js` calls `enableShadowDOM()` from the pinned
  `react-stately/private/flags/flags` compatibility path before the component
  tree loads. This lets React Aria follow composed event targets and focus
  through the shadow boundary.
- `UNSAFE_PortalProvider` from the pinned `react-aria/PortalProvider` path sends
  React Aria's overlays (the sheet and the toasts) to a portal element inside
  the same shadow root, `div.maison-overlays`, which `mountDashboard`
  appends. `PortalContext` in `src/contexts.js` hands the same element to the
  Sheet, which names it as its container.
- `OverlayBoundary` in `src/ui/overlay-boundary.jsx` gives overlays opened
  inside a sheet a portal inside that sheet. A sibling portal could be marked
  inert by the sheet's modal isolation as it mounts.

Those private/unstable paths are deliberate compatibility adapters. When
upgrading React Aria or React Stately, verify pointer presses, keyboard focus,
Escape dismissal, focus restoration, and nested overlays inside Home Assistant
before changing the pins.

## React Aria build-time fixes

`react-aria-compat.mjs` patches two pinned React Aria 3.52.1 helpers while
esbuild bundles, in both bundles. `node_modules` stays untouched, both bundles
carry a modification notice, and the build fails if the version, the source
needle or the number of applications differs from what the adapter expects.
Each adapter finds its module by its path under this directory's
`node_modules/react-aria`. A module reached another way (a symlinked
`node_modules`, or pnpm's isolated layout) is never patched, and the build
fails rather than shipping it unpatched. Both fixes guard Maison's own sheet
and fields, which are React Aria's, so they stay with one design.

- **Slot containment.** React Aria skips the slot element when checking
  composed-tree containment. In HA's slotted ancestors, modal isolation then
  marks an enclosing slot `inert`, blocking sheet scrolling and retargeting
  clicks to the backdrop. The fix makes the containment walk visit each
  assigned slot, including forwarded slots. Do not remove it until an upstream
  update passes the nested-slot regression tests and browser fixture.
- **iOS blur.** `useDialog` blurs and refocuses after 500 ms;
  `usePreventScroll`'s keyboard-Done fallback read that as a keyboard
  dismissal, moved focus to the parent overlay and closed a nested one. The
  fix limits that fallback to fields that open the software keyboard; React
  Aria's refocus, keyboard-field handling, scroll locking and normal
  dismissal are unchanged. It was found on the light Appearance popover,
  since retired, and stays because it is harmless and guards any future
  nested overlay.

`tests/maison-shadow-dom.test.mjs` and `tests/maison-ios-focus.test.mjs` hold
each fix to its source, its fail-closed checks and the bundled module.

## React Aria Components

Maison's own controls are built on React Aria Components, imported by subpath
(`react-aria-components/Button`, `/Switch`, `/Modal` and so on). It is a
direct dependency, pinned exactly at 1.21.1, which pins React Aria 3.52.1 and
React Stately 3.50.0 exactly, so `node_modules` holds one of each. Each
build-time fix must be applied exactly once, to exactly one bundle input, so
a second copy fails the build rather than shipping unpatched. Upgrade the
three together: the build fails until `react-aria-compat.mjs` is updated for
the new React Aria. Then re-run the checks under
[React, portals, and shadow DOM](#react-portals-and-shadow-dom).

## Maison's base layer

`src/frame.css.js` starts with Maison's base, in one cascade layer,
`@layer m-base`:

- every element and pseudo-element sizes its border box and starts with no
  margin, padding or border (`border: 0 solid`);
- the host's text is the system font stack at 14 px with a line height of
  1.5, which a part with no type token inherits, never inflated on a phone,
  with 4-space tabs and no grey tap flash;
- a button, an input or a select takes its font and colour from around it,
  with no background of its own;
- a list has no markers;
- the date field's WebKit parts (`::-webkit-datetime-edit`, its fields
  wrapper and each field) add no padding;
- figures in a `b` are tabular (the gallery's token values).

It exists because of how the pages were drawn until v36. The element put
HeroUI's stylesheet, with Tailwind's preflight reset, and `styles.js`'s host
rule into the shadow root, and every page, sheet and reviewed image was drawn
on top of them. When they left, Maison took over exactly what still moved a
pixel. Two rules move no pixel
today and keep React Aria's unclassed parts as they were drawn: a control
has no background of its own (the picker's hidden select, a sheet's hidden
dismiss button), and a list has no markers (the toasts' list).

It is a layer because any rule outside a layer beats every rule inside one,
whatever its selector. Unlayered, the universal reset could beat a
single-class `.m-` rule's margin or padding; inside `m-base`, every other
Maison rule wins over it. `tests/maison-styles.test.mjs` holds it to exactly
these rules: it is the only `@layer` in Maison's stylesheets, the only place
text is set without a type token, and it declares no token. A change to it
is deliberate.

## Source layout

- `src/app.jsx`: `mountDashboard` and `App`, the frame with the page, the
  open sheet or dialog and the toasts. The dashboard's entry exports
  `mountDashboard` alone.
- `src/app.css.js`: `appStyles`, the dashboard's one sheet: `uiStyles` and the
  frame's; then the sky's, the hero's and the header charts'; then Today's
  page; then Climate's page, its sheets and the 24-hour chart; then Energy's
  chart, page and sheets; then the Car's; then Home status's and the dialogs'. Each
  comes after what it draws on, so it wins a tie. The gallery draws with it
  too.
- `src/gallery.jsx`: `mountGallery` (see
  [Component gallery and visual checks](#component-gallery-and-visual-checks)).
- `src/contexts.js`: `CommandContext` (with `useCommand`) and `PortalContext`,
  in a module of their own, so the controls in `ui/` read them without
  importing a page.
- `src/native.jsx`: `Native`, the empty slot for a Home Assistant card, and
  `NativeContext`, which carries the element's `attachNative`.
- `src/shadow-dom.js`: the shadow-DOM adapter both entries load first.
- `src/history-format.js`: what the 24-hour chart formats beside its model:
  its time axis and a hovered point's time (`formatHistoryTime`), a hovered
  value (`formatHistoryValue`) and which samples stand alone
  (`isolatedPointIndices`). Its `formatHistoryValue` is a copy of
  `history.js`'s, since the bundle imports no rule module;
  `tests/maison-history-chart.test.mjs` keeps the two equal.
- `src/gallery-snapshots.js`: what the gallery draws from: `ScreenContext`,
  the snapshot builders (`climateSnapshot`, `carSnapshot`, `pageSnapshot`),
  the pending, rejected and loading states, and the placeholder for a Home
  Assistant card. For the hero:
  - `skySnapshot(id, page)`, one sky fixture's sun and weather alone, at its
    time;
  - `heroSnapshot(page, variant)`, a sky fixture laid over a page fixture, at
    the sky's time, with `SKY_FORECAST` on Today;
  - `HERO_VARIANTS`, each page's variant ids in gallery order.

  For the pages view, per page, a list and its builder: `TODAY_PAGES` and
  `todaySnapshot(id)`, `CLIMATE_PAGES` and `climatePageSnapshot(id)`,
  `ENERGY_PAGES` and `energyPageSnapshot(id)`, `CAR_PAGES` and
  `carPageSnapshot(id)`, and `SYSTEM_PAGES` and `systemPageSnapshot(id)`,
  each a page fixture under a sky fixture. Then the sheets drawn in place,
  each a fixture with one sheet open: `CLIMATE_SHEETS`, `ENERGY_SHEETS` and
  `CAR_SHEETS`, with their builders, and `sheetSnapshot(id)`, which hands a
  sheet's id to Energy's builder when it starts `energy-`, to the Car's when
  it starts `car-`, and to Climate's otherwise. Last, `DIALOG_SNAPSHOTS` and
  `dialogSnapshot(id)`, a home fixture on Today with one dialog open (the
  alerts with two waiting and with none, an event, the Full calendar).
- `fixtures/`: the synthetic states, each `{id, title, …}`, from which
  `fixtureSnapshot(overrides)` (`fixture-snapshot.js`) builds a snapshot in
  the exact shape of the element's `snapshot()`:
  - `today-fixtures.js`: `TODAY_FIXTURES`, and `TODAY_WEEK`, seven events in
    three days and a collection on Friday, so Coming up says "N more";
  - `climate-fixtures.js`: `CLIMATE_FIXTURES`, the zones' schedules and
    `CLIMATE_NOW`;
  - `energy-fixtures.js`: `ENERGY_FIXTURES`, the home's states with a few
    readings replaced (`covered`, `billing`, `night`, `missing`), Helios's
    forecast for the day, and their power since midnight;
  - `car-fixtures.js` and `car-page-fixtures.js`: `CAR_FIXTURES` at
    `CAR_NOW`, and `CAR_PAGE_FIXTURES`, eleven Car states no `CAR_FIXTURES`
    entry reaches, built from them in the same shape;
  - `home-fixtures.js`: `HOME_FIXTURES` (`full`, `quiet`, `missing`),
    `HOME_POWER_HISTORY`, the day recorded from midnight (`HOME_MIDNIGHT`)
    for Energy's chart, and `recordedDay`, which builds such a day;
  - `sky-fixtures.js`: `SKY_FIXTURES`, eleven skies on Monday 28 September
    2026 in Brussels, from a clear night to a storm, and one with neither
    the sun nor the weather; and `SKY_FORECAST`, four days of forecast.
- `src/ui/`: Maison's own controls. Each is `<name>.jsx` plus
  `<name>.css.js`, which exports `<name>Styles`: `button`, `switch`,
  `segmented`, `stepper`, `list`, `card` and `sheet`. A button whose Control
  is `busy` is pending (it keeps its focus and reads its `busyLabel`), and
  `ListRow` has an `unavailable` state, a `tint`, a `badge` and a
  `describe`. The widgets and the parts the pages are composed of follow
  the same pattern: `widget` (`WidgetGrid`, `Widget`, `useWidgetSurface`;
  a title row's `action`), `ring` (`Ring`, and `RingPair`, Energy's two
  register rings at three sizes), `segment-bar` (`SegmentBar`, `Legend`),
  `glance` (`GlanceChips`), `figure` (`Figure`), `quiet` (`QuietLine`) and
  `chip` (`Chip`, a state in a tinted capsule). So do the sheet parts:
  `target-bar` (`TargetBar`), `disclosure` (`Disclosure`), `date-field`
  (`DateTimeField`), `feedback` (`Feedback`) and `day-bar` (`DayBar`);
  `sheet.jsx` also has `SheetPlacementContext` and `useSheetPlacement()`,
  where the sheet around a part sits. Then the search field and the picker,
  which Home status draws, and the toast:
  - `search-field` (`SearchField`) is React Aria's search field as iOS's
    search bar, controlled by a Link's `value`, sending `{...intent, value}`
    on each change while keeping its focus and caret, its Search key (Enter)
    blurring it so the keyboard goes down;
  - `picker` (`Picker`) is a gray capsule over an unseen native `<select>`,
    sending `{...intent, value: id}`, so an iPhone opens its own menu;
  - `toast` (`ToastRegion`, `createToastQueue()`) is Maison's toast on React
    Aria's `UNSTABLE_ToastRegion` and `UNSTABLE_ToastQueue`, drawn in the
    portal. Its close button takes no focus (`Button` passes React Aria's
    `preventFocusOnPress` through), since focus inside the region would
    pause the other toasts' timers. A toast already showing when a sheet
    opens is made inert with the page, so the region is hidden while inert
    (`.m-toast-region[inert]`) and comes back when the sheet closes.

  The field and the picker draw their text at 17 px, so iOS doesn't zoom in
  on focus. Beside them:
  - `tokens.js`, the tokens;
  - `base.css.js`, the states every control shares (no tap flash, the 44 px
    hit area, the glyph box);
  - `breakpoints.js`, `layoutFor(width)` with no React, and `layout.js`, its
    hooks: `useFrameLayout(ref)` follows Maison's own width, and
    `useWideViewport()` the viewport a sheet covers. Its `LayoutContext`
    carries the layout the frame measured to the page, and `useLayout()`
    reads it ('phone' outside a frame);
  - `grid.js`, the widget grid's `SIZES`, `COLUMNS` and
    `placeWidgets(items, columns)`, with no React, so the Node tests check
    the placements the page draws;
  - `glyph.jsx`, an icon from `icons.js`;
  - `overlay-boundary.jsx`;
  - `sheet-drag.js`, the sheet's swipe decisions with no React or DOM;
  - `temp-scale.js`, `tempColour(t)`, a temperature's colour on
    `TEMP_SCALE`, for the target bars, a zone's glyph and the charts.

  `ui/index.js` re-exports every control whole (`export *`), so export names
  must be unique across controls. It also builds `uiStyles` in a fixed order:
  the tokens, the shared states, each control, then the widgets and the
  parts, then the sheet parts, then the chip, then the search field, the
  picker and the toast.
- `src/pages.jsx`: `PAGES`, the component for each page id: `TodayPage`,
  `ClimatePage`, `EnergyPage`, `CarPage` and `SystemPage`.
- `src/pages/`: the pages, each `<page>.jsx` plus `<page>.css.js`, which
  holds only what is the page's own.
  - `today.jsx`: the glance chips and the stacked widgets on a phone, the
    widget grid from 700 px, then the vacuum's quiet line. `today.css.js`
    holds the chips' bleed, the quiet line's place and the widget bodies'
    layout.
  - `climate.jsx`: the scale legend, then House heating, the zones as one
    list (`ZoneRow`, which the gallery draws too) and the towel rails on a
    phone, and the value's `widgets` from 700 px.
  - `energy.jsx`: the price, the billing year, the bill and cap credit as
    one list and the chart on a phone, and the value's `widgets` from 700
    px, the chart first and Price before it at wide. The chart's Details
    open the Energy today sheet (v37).
  - `car.jsx`, in `div.m-car-page` (`m-car` is the hero chart's block): the
    battery, charging while the Car is plugged in, the charging energy and
    Automatic charging (`value.automatic`), stacked on a phone, where
    Automatic charging is one inset row with no widget round it, and the
    value's `widgets` from 700 px, a large one drawn medium at wide
    (`WIDE`). Which charging form it draws is the value's `kind`, never a
    Control's `enabled`.
  - `system.jsx`, in `div.m-system-page`: `__checks` (Needs attention, Key
    devices, Vacuum maintenance, Home Assistant) then `__sensors` (All
    sensors, with the `SearchField` and the `Picker`), each section a
    `SectionTitle` over an iOS grouped list. Each section is drawn once at
    every width: on a phone the checks' box gives way and Home Assistant
    moves after All sensors, so the field is never mounted again. From
    700 px the two boxes are columns, the checks sticky while they fit their
    scroll container (`useTall()` adds `__checks--tall` when they don't).
    `scrollerOf()` finds that container as the element's
    `scrollContainers()` does, through slots and shadow roots: Home
    Assistant's own view scroller, or else the window.
- `src/drawers.jsx`: `DRAWERS`, each sheet's body by the Drawer body's
  kind: Climate's (`house`, `zone`, `rails`) from `drawers/climate.jsx`,
  Energy's (`price`, `year`, `bill`, `day`) from `drawers/energy.jsx`, and
  the Car's (`battery`, `sources`) from `drawers/car.jsx`, each with its
  `.css.js`: iOS grouped sections, each headed by the value.
- `src/dialogs.jsx`: `DIALOGS`, each dialog's body by its kind:
  `AlertsDialog` (the alerts as orange rows, or one gray-check row with a
  footnote, then Home status), `EventDialog` (the date over the location;
  the description on a card with the calendar as its footnote; then Full
  calendar) and `NativeDialog` (the Home Assistant card in `div.m-native`).
  `dialogs.css.js` maps Home Assistant's card variables onto Maison's tokens
  in both themes, never onto a literal.
- `src/sheets.jsx`: `DrawerSheet`, the drawer's `DRAWERS` body in the Sheet,
  and `DialogSheet`, the dialog's `DIALOGS` body in it.
- `src/frame.jsx` and `frame.css.js`: `Frame`, the tab bar, the hero, the
  banner and the status line from the chrome value; it hands its layout to
  the page through `LayoutContext`. The page (`main.m-page`) is at least
  240 px high. `frame.css.js` also holds the
  [base layer](#maisons-base-layer).
- `src/hero.jsx` and `hero.css.js`: `Hero`, the sky, the header (date,
  title, line and tools) and the page's reading and header chart, and
  `HERO_PARTS`, each hero kind's `Reading`, `Chart` and `readingOn`
  (`'always'` or `'desktop'`). Both receive `{value, phase, layout}`:
  `chrome.hero`, the sky's phase and the frame's layout.
- `src/sky-model.js`: `skyPaint(sky)`, pure (no React or DOM), turning
  `chrome.sky` into the phase, the gradient's stops, the sun's glow, the
  warm horizon, fog's haze, the clouds, the stars and what falls, each light
  capped for the text over it. It is memoised on rounded inputs, so an update
  doesn't restart the clouds' drift. `TEXT_BANDS` says where text sits.
- `src/sky.jsx` and `sky.css.js`: `Sky`, the paint laid out as a hidden layer
  that fills the hero and fades into the page.
- `src/charts/`: the charts, each `<name>.jsx` plus `<name>.css.js`. The
  header charts are `weather` (`WeatherReading` and `WeatherChart`), `zones`
  (`ZonesChart`, which Today's Climate widget draws at widget size with
  `variant="widget"`), `flows` (`FlowsChart` and `FlowsReading`, the price)
  and `car` (`CarChart`); `scale.js` re-exports `tempColour(t)`. `history`
  (`HistoryChart`) is the 24-hour chart, and `history-plot.js` its geometry,
  pure (no React, DOM or clock). Its model comes from the served
  `history.js`: `historyChart(snapshot, definition)` reads the snapshot's
  per-group Recorder cache, the units Home Assistant reports and the
  snapshot's time zone and time, and never fetches data, dispatches a
  service or reads the clock. It draws in a sheet. Full history calls
  `command(full.intent)`, the user-triggered `native-history` intent.
  `day` (`DayChart`, v37) is Energy's Through the day, today's power from
  midnight, and `day-plot.js` its geometry, pure as well: the value scale
  from zero, monotone curves, the half hours' runs and the clip that shows
  the grid's share. Its model is `energy.js`'s, from `history.js`'s
  `powerDay`. In a widget it takes its plot's height from `DAY_PLOT`, and
  `fill` lets it fill the grid's xl widget.
- `src/gallery/`: the gallery's sections, one per file, each exporting
  `<X>Section` and `<x>GalleryStyles`, built from `GallerySection`,
  `GalleryGroup` and `Specimen` in `gallery/section.jsx`. A frozen state
  (pressed, focus-visible) is an inert copy with the control's classes plus
  `data-pressed` or `data-focus-visible`. `sky.jsx` draws the sky fixtures,
  and `heroes.jsx` the heroes through `HeroSpecimen`, with one file per
  chart (`heroes-weather.jsx`, `heroes-zones.jsx`, `heroes-flows.jsx` and
  `heroes-car.jsx`) listing its variants. `widgets.jsx` draws the widgets
  (`widget-specimens.jsx`) and the parts (`part-specimens.jsx`), and
  `details.jsx` the sheet parts (`detail-specimens.jsx`), the 24-hour
  chart and Energy's (`chart-specimens.jsx`). `pages.jsx` is the pages view
  (`PagesGallery`), and `frames.jsx` the frames.

Controls are adapters over values: a Control or Link press sends
`command(action.intent)` through `useCommand()`, and `enabled: false`
disables it, covering offline and a refusal. A Control in flight is `busy`
as well, and draws as pending instead: focused, ignoring presses. React
composes no English: every word comes from the value, apart from fixed UI
words already in use ("Close"). The JSDoc above each control is its
contract. The header charts are readings: they send no command, and their
words come from `chrome.hero` too. A page draws only its value's Links and
Controls, and a widget with a link holds no other press.

### Tokens and their rules

`src/ui/tokens.js` exports `SHARED`, `LIGHT` and `DARK`, which map custom
property names (without the leading `--`) to values, and `tokenStyles`,
built from them. The shared tokens are the fonts and type styles, the
temperature scale, radii, spacing, sizes, glass, motion and stacking, and
the sky's and the header charts' own colours, which sit on the sky and so
are the same in both schemes. `LIGHT` and `DARK` hold the colours and
shadows, with the same keys in the same order. `tokenStyles` declares them
on `:host` (light) and `:host([dark])` (dark, the attribute the element sets
from Home Assistant's theme), and defines `.m-num`, the rounded face with
tabular digits. `THEMED = false` would make Maison dark-only.

The hero draws on the dark set in both schemes. `tokenStyles` declares
`DARK` again on `.m-hero`, with `--m-label-2` taken from `--m-sky-label-2`
(white at .85). Inside the hero `--m-bg` is therefore the dark one, so the
sky fades into `--m-page-bg`, the page's own background read on the host.
Two exports are colours that code computes with, never custom properties:

- `TEMP_SCALE`, the temperature scale as `[°C, colour]` stops, in the
  colours of `--m-temp-1…6`, which the zone capsules, the target bars, a
  zone's glyph and a room reading in the charts interpolate on
  (`ui/temp-scale.js`);
- `SKY`, the sky's keyframes, four stops each, and the colours of what is
  drawn on it (clouds, stars, the sun's glow, the warm horizon, rain, snow,
  hail and fog), from which `sky-model.js` paints the sky.

`tests/maison-styles.test.mjs` reads every `*.css.js` under `src/` and
enforces:

- **Selectors.** Each starts with `.m-` or `:host`. Rules inside `@media`
  and `@supports` obey the same; `@keyframes` steps are exempt.
- **Colours.** No colour literal outside `tokens.js`: no hex, no colour
  function (`rgb()`, `hsl()`, `oklch()`, `color()` and the like) and none of
  CSS's named colours. `transparent`, `currentColor` and `inherit` are
  allowed. The components write none either: no hex, `rgb()`, `rgba()`,
  `hsl()` or `oklch()` in a `.jsx` file. A chart, a glance chip's dot or the
  sky names a token, or computes its colour from `TEMP_SCALE` or `SKY`.
- **Type.** Outside the base layer, text is set only with
  `font: var(--m-type-…)`, never `font-size` or another `font` value. That
  includes icons, which are sized with `width` and `height`. There are nine
  text styles over six sizes (34, 22, 17, 15, 13 and 11 px), and three
  figure styles for numbers only: `--m-type-figure` (22 px),
  `--m-type-figure-large` (44 px, a header's or a widget's main figure) and
  `--m-type-display` (96 px). Each is a whole `font` shorthand naming the
  font. A shorthand resets `font-variant-numeric`, so a figure sets
  `tabular-nums` after it. `--m-type-caption` (11 px) appears only in
  `frame.css.js`, for the tab labels, and in `charts/*.css.js`.
  `--m-type-display` appears only in `charts/weather.css.js`, for the
  weather's temperature.
- **At-rules and sources.** A stylesheet writes only `@media`, `@supports`,
  `@keyframes` and the base layer, and loads nothing from outside Maison: no
  `@import`, no `@font-face`, no remote `url()`.
- **Containing blocks.** Nothing above the phone tab bar (`:host`, `.wrap`,
  `.m-app`, `.m-content`) sets `transform`, `translate`, `rotate`, `scale`,
  `filter`, `backdrop-filter`, `contain`, `container`, `container-type`,
  `will-change` or `perspective`. Any of them would make that element the
  fixed tab bar's containing block, instead of the screen. `.m-sheet`, the
  tab bar, the hero (the tab bar's sibling) and anything inside them may.
- **The hero's tokens.** The `.m-hero` block declares every `DARK` key, and
  `--m-page-bg` is `var(--m-bg)`, read on the host.
- **Imports.** `src/ui/` imports only React, React Aria Components,
  `react-aria` paths, `../contexts.js`, `icons.js` and its own files.
  `tests/maison-dialogs.test.mjs` holds all of `src/` to no HeroUI, Recharts
  or Tailwind import, and checks that `package.json` and its lockfile list
  none of them.
- **Composition.** The breakpoints: phone below 700 px, wide to 1,099 px,
  desktop from 1,100 px. Both entries load `shadow-dom.js` first and never
  read or branch on a `design`. `App` and the gallery's frames draw pages
  from `PAGES`, and `uiStyles` ends with the widgets, the parts, the sheet
  parts, the chip, then the search field, the picker and the toast. The
  gallery draws its twelve sections in order: tokens, buttons, switches,
  segmented, steppers, lists, sheets, sky, heroes, frames, widgets and
  details.

One rule has no test. Outside the base layer, never set `font` on `:host`,
`.wrap` or `.m-app`, or `color` on `.wrap` or `.m-app`: each frame element
sets its own. The host's text colour is Maison's label colour, set in
`frame.css.js`.

### The sheet in the shadow DOM

`src/ui/sheet.jsx` is React Aria Components' `ModalOverlay`, `Modal` and
`Dialog`, so focus is held inside and given back, and Escape and the scrim
dismiss it. It is drawn in the portal inside Maison's shadow root: `Sheet`
reads the portal from `PortalContext` and passes it as
`UNSTABLE_portalContainer`. Its content sits inside `OverlayBoundary`, so
anything opened within it stays within it, where the slot-aware containment
check finds it. Both build-time fixes apply to it.

Below 700 px of viewport it is a bottom sheet, sized to the visual viewport
React Aria measures, so it rises above the iPhone keyboard; from 700 px it is
a centred sheet. `sheet-drag.js` decides a swipe (when a press becomes a drag,
how far the sheet follows, whether a release dismisses) and `useSheetDrag`
feeds it pointer events. Only the grabber and the header (`[data-sheet-drag]`)
start a drag, never a control inside them. The body scrolls itself
(`touch-action: pan-y`, contained overscroll). Transforms go on `.m-sheet`
itself, never on an ancestor of the page.

## Tests

The Node suites run from the repository root with
`node --test tests/maison-*.test.mjs`. The suites that read the served
modules (`maison-agreement`, `maison-car`, `maison-car-routes`,
`maison-chrome`, `maison-climate`,
`maison-dashboard`, `maison-data`, `maison-energy`, `maison-guard`,
`maison-hero`, `maison-history-chart`, `maison-screen`, `maison-sky`,
`maison-system` and `maison-today`) are described in
the [top-level README](../../README.md).
The suites below hold the React side. Node has no JSX, so the markup suites bundle the
components with esbuild and render them with `react-dom/server`, from the
values `screen()` builds over the fixtures, online and offline:

- `maison-styles`: the tokens, the stylesheets' rules above, the base layer
  and the composition.
- `maison-bundles`: no React source imports a served module but `icons.js`,
  the fixtures import only `model.js` and each other, and `vendor/` holds
  exactly the two bundles and their licenses, since a deploy never deletes a
  file.
- `maison-shadow-dom` and `maison-ios-focus`: the two React Aria fixes.
- `maison-controls-a` and `-b`: what the switch, the segmented control, the
  stepper, the buttons, the list and the card draw, and what they read from
  every fixture's values; a busy button or stepper drawn as pending, and
  the unavailable row.
- `maison-parts`, `-b` and `-c`: the parts (the ring, the segmented bar and
  its legend, the glance chips, the figure, the quiet line), the sheet parts
  (the target bar, the disclosure, the date field and the intent it sends,
  feedback, the day bar, the Widget's `action`, the ListRow's `tint`,
  `badge` and `describe`) and Energy's (the ring pair and the chip), with
  their gallery specimens.
- `maison-widgets` and `maison-grid`: the stack and the grid, a linked
  widget as one press, the metrics behind `WIDGET_ROWS`, and
  `placeWidgets`'s sizes, clamping, sparse order and holes.
- `maison-sheet`: the sheet's swipe decisions (`sheet-drag.js`).
- `maison-frame`: the frame and the hero's slots, the reading only where its
  kind's `readingOn` allows it, and no reading or chart on Home status.
- `maison-charts-a` (the weather and the Car) and `-b` (the zones, the flows
  and `tempColour`): the header charts, "—" drawn apart from zero, no tick
  while the heating is off, and solar asleep apart from unavailable.
- `maison-sky-paint`: `skyPaint`'s phases, stops and determinism, and that
  white text and the dark set's secondary grey still read over the sky at
  every elevation from −18° to 70°, for every kind and cover.
- `maison-history-plot`: the 24-hour chart's value scale, round hours in the
  time zone, runs and gaps, the stepped target, isolated dots, colours by
  role, the scrub, the legend and Full history, and Climate's charts drawn
  exactly as in v32.
- `maison-day-chart`: Energy's Through the day: the value scale from zero,
  curves that never overshoot, the half hours' runs, the hours of a 24- and
  a 25-hour day, the day's figures in every state, a scrub's half hour and
  means, and each state's stand-in.
- `maison-today-page`, `maison-climate-page`, `maison-energy-page`,
  `maison-car-page` and `maison-system-page`: each page's markup per fixture
  and layout, every word taken from the value. `maison-today-page` also reads
  the sources of the pages, the sheet bodies, the 24-hour chart and the
  sheet parts: they write no English.
- `maison-climate-sheets`, `maison-energy-sheets` and `maison-car-sheets`:
  each sheet body per fixture, its sections in order under the value's
  headings, and "—" where the value says it.
- `maison-dialogs`: each dialog body from the value, the card's frame
  mapping every Home Assistant variable onto a token in both themes, every
  Home Assistant card under `src/` as the only child of `div.m-native`,
  Maison's toast queue and toast, `appStyles` holding only Maison's
  selectors, and the import rule.
- `maison-pages-gallery`: the pages view's snapshots, the `?view=pages`
  hand-off, the order of its windows, and each window's containment.

## Component gallery and visual checks

Run the repository's isolated preview server:

```sh
node ../../tools/maison-preview.mjs --port 8766
```

Then open `/gallery?theme=light` or `/gallery?theme=dark`, the gallery in
twelve sections. It draws with the dashboard's own styles (`appStyles`), so
a control looks as it will in Home Assistant. It shows the tokens, then each
of Maison's own controls in every state, then the sheets, each opened by a
button ("Open zone sheet" opens the Attic's Climate sheet). Next comes the
sky, every `SKY_FIXTURES` sky as a strip about 120 px tall, drawn from the
served `screen()`'s `chrome.sky` (`skySnapshot`). Then the heroes, each
page's `HERO_VARIANTS` over its own sky (`heroSnapshot`), at phone width and,
from a 1,240 px gallery, at desktop width. Then every page inside the frame
under its hero, at phone, wide and desktop sizes, then the widgets and the
parts, and last the sheet parts and the 24-hour chart: the target bar, the
disclosure, the date field, feedback, day bars, the title action and tinted
rows in every state, the chart ready, scrubbed, partial, loading, in error
and empty, the ring pair, the chip and Energy's Through the day in a
widget: on a phone's card and filling the grid's xl widget.

Add `&view=pages` for the pages view instead: Today whole inside the frame,
each page from `todaySnapshot`, in five phone windows, and in wide and
desktop windows on a viewport that holds them (from 760 and 1,180 px).
Climate, Energy, the Car and Home status follow in the same sizes, each in
sections tagged `data-gallery-<page>-size` (`data-gallery-size` for Today's),
Climate, Energy and the Car each followed by their sheets drawn in place and
whole, each as a 375 px bottom sheet and a 640 px form sheet (from a 760 px
viewport). Home status is followed by the dialogs from `dialogSnapshot`,
drawn in place as the sheets are, in `section[data-gallery-dialogs]`, each
in a window `data-gallery-sheet="<bottom|form>-dialog-<id>"`.

Each state is a snapshot: `fixtureSnapshot(overrides)` builds one in the
exact shape of the element's `snapshot()`, and the served `screen()` turns
it into the values production draws. `dev/maison/gallery.html` imports
`screen.js` from the preview and calls `mountGallery(target, {theme, screen,
view})`, so the gallery runs the same rules and guard as production without
embedding them. The gallery needs no fake controller; its presses do
nothing, and a Home Assistant card's slot shows a note that only the
installed dashboard draws it. The gallery has no Home Assistant connection
and sends no device calls.

Use `/gallery?theme=light&host=slotted` (or dark) for the deterministic
nested-slot regression fixture. The full dashboard supports
`/?host=slotted#climate` with its usual sanitized snapshot. Both use two
slotted shadow hosts and an inner page scroller. Verify sheet scrolling,
Escape and focus restoration here; the plain standalone preview cannot expose
the slot-isolation failure.

To see a real sky, give the preview a snapshot that holds `sun.sun` and
`weather.forecast_home`:

```sh
node ../../tools/maison-preview.mjs --port 8766 --snapshot /private/path/states.json
```

Then open `/`. The preview serves `sun.sun` with its `elevation`, `azimuth`
and `rising`, and the weather with its `cloud_coverage`, so the hero draws
the sky and readings of the moment the snapshot was taken, whatever the hour
of the preview. The preview loads no forecast, so Today's row of days shows
only in the gallery. The preview reads its route list, and which entities it
serves, when it starts: restart it after a served module or an entity is
added.

Both Playwright suites start the preview on `MAISON_PREVIEW_PORT`, or 8767 when
it is unset, and reuse whatever already listens there. Parallel sessions each
pass their own, for example `MAISON_PREVIEW_PORT=8771 npm run test:touch`. A
preview started by hand for a suite takes the same number (`--port 8771`).
Keep a snapshot preview on a port of its own, or the suites would draw its
states. The wine-cellar `npm run preview` also uses 8767, so stop it first
or pass another port. The preview serves the bundles in
`config/www/maison/vendor/`, so rebuild after editing `src/`.

The visual regression source covers 375-pixel phone and 1280-pixel desktop
viewports in both themes:

```sh
npm run test:visual
```

The suite runs every `visual/*.visual.spec.mjs`, which is
`visual/maison.visual.spec.mjs` alone. It screenshots the gallery, its sky
strips, heroes and opened sheets, the desktop gallery window, each page's
sizes in the pages view, the sheets and the dialogs drawn in place (bottom
sheets on the phone project, form sheets on the desktop one), and the
dashboard itself on every page, against baselines named `maison-*` in
`visual/__snapshots__/phone-375/` and `desktop-1280/`, drawn with Playwright
1.63's pinned Chromium. Every change must match them, within a pixel-diff
ratio of 0.001. Beside the images it checks what an image can't show: every
widget row fills and is 168 px from 700 px, no widget or sheet body holds
more than it shows, nothing leaves a window or scrolls sideways, nothing
above a tab bar gives it a containing block, Home status stands in one
column on a phone and two equal ones from 700 px, and a zone sheet stays
interactive inside slotted Home Assistant ancestry, which needs no baseline.

The normal command never creates or updates screenshot baselines
(`updateSnapshots: "none"`). Baselines are recorded only after Alex has
reviewed the images, and a change that alters one is reviewed with him
again. Never update a baseline to make a failure pass: a changed image is
reviewed with Alex first, and only then recorded with
`npm run test:visual -- --update-snapshots`.

Touch interaction checks run separately from screenshot comparisons, with
Playwright 1.63's own Chromium and WebKit installed:

```sh
npm run test:touch
```

The suite runs every `visual/*.touch.spec.mjs`:

- `loading.touch.spec.mjs` blocks `vendor/maison-react.js` and checks the
  loading line, the "Maison couldn’t load" notice and its Retry button, then
  that Maison loads and a zone's sheet opens and closes.
- `today.touch.spec.mjs`: the chips, the widget presses, the rows and
  "N more" take a 44 px touch, a swipe along the chips moves neither the
  page nor the document sideways, the last content clears the tab bar, and
  a busy button keeps its focus.
- `climate.touch.spec.mjs`: the rows, Details, Dry towels, and the sheets'
  steppers, segments, switches, disclosures and date field take a 44 px
  touch; nothing scrolls sideways; scrubbing a chart neither pans the sheet
  sideways nor blocks its vertical scroll; a busy Dry towels keeps its
  focus; and a disclosure opens by touch.
- `energy.touch.spec.mjs`: every linked card, money row, rate row and Full
  history, and every row, link and Why in the sheets, takes a 44 px touch;
  a card or a row opens its sheet by tap and Back closes it; a direct
  `#energy/bill` opens Bill; nothing scrolls sideways at 320, 375 and
  393 px, sheets included; a sideways drag on the phone's chart scrubs it,
  while a vertical swipe that starts on it scrolls the page.
- `car.touch.spec.mjs`: the linked cards, Charge now, the stepper, Wake,
  Automatic charging's switch and the sheets' rows take a 44 px touch; a
  card opens its sheet by tap and Back closes it; a direct `#car/battery`
  opens Battery; nothing scrolls sideways at 320, 375 and 393 px; a sleeping
  Car shows Wake, with no Charge now or stepper; a charging control in
  flight stays drawn, pending; and through a Charger dropout the Car draws
  the headline it kept.
- `system.touch.spec.mjs`: every row is 44 px high, and every pressable
  row, the search field, its clear button and the picker take a 44 px
  touch, the field and the picker drawing their text at 16 px or more;
  typing keeps the field focused with the caret at its end, and the Search
  key blurs it; the picker changes the category; Show more adds readings
  until none is left; a reading opens its more-info; a `#life` link lands
  on `#today`; the alerts, an event and the Full calendar open as sheets and
  close; and the tab bar has four tabs.
- `frame.touch.spec.mjs`: every tab and header tool takes a 44 px touch, and
  the phone tab bar stays over Maison, clear of Home Assistant's docked
  sidebar.
- `sheet.touch.spec.mjs` keeps a zone's sheet open through touches in plain
  and slotted gallery hosts, and in the dashboard
  (`/?host=slotted#climate`) during state updates and a comfort change. It
  adds the sheet's own checks:
  - a swipe down the grabber past 30 % of the sheet dismisses it;
  - a short one sends it back;
  - a quick flick dismisses it however short;
  - the close button never starts a drag;
  - a swipe or wheel on the body scrolls the body, never the page;
  - the sheet follows the visual viewport as it shrinks.

On Chromium a swipe is a real touch (CDP touch events, so `touch-action`
decides who gets it). Playwright has no touch input on WebKit, so there it is a
mouse pointer. The tests use normal animations, touch taps, and
WebKit/iPhone, Chromium/iPhone, and Chromium/Android profiles.
`MAISON_WEBKIT_EXECUTABLE` and `MAISON_CHROMIUM_EXECUTABLE` can select existing test
browser executables. Browser emulation does not replace a physical iPhone test:
the iPhone projects explicitly set `navigator.platform` and touch capability,
since the device user-agent alone leaves macOS WebKit reporting `MacIntel`.
Checks cover the sheet surviving `useDialog`'s 500 ms refocus, a comfort-target
change during state updates, Escape dismissal, and focus restoration. Physical
iOS 27 verification remains a post-deployment check.

## Provenance and licenses

- React and React DOM 19.3.0, with `scheduler` and `use-sync-external-store`
- React Aria 3.52.1, React Aria Components 1.21.1 and React Stately 3.50.0,
  with React Aria's `@internationalized` packages
- `clsx` 2.1.1, which React Aria brings
- esbuild 0.28.2, used only at build time; Playwright 1.63.0, used only by
  the visual and touch suites

esbuild's `legalComments: "eof"` keeps React's source-level `@license` notices
in both browser bundles. Full upstream license texts are also copied verbatim
to `config/www/maison/vendor/`, and the build checks that each bundled
package ships the same text:

- `LICENSE.React.txt` covers React, React DOM, `scheduler` and
  `use-sync-external-store`'s MIT text;
- `LICENSE.React-Aria.txt` covers React Aria, React Aria Components, React
  Stately and the `@internationalized` packages' Apache 2.0 text;
- `LICENSE.clsx.txt` covers `clsx`'s MIT text.

## Icon subset

`build-icons.mjs` generates `config/www/maison/icons.js` from pinned Iconify data:

- `@iconify-json/gravity-ui` 1.2.14 (Gravity UI Icons 2.21.0, MIT), Maison's
  main family.
- `@iconify-json/lucide` 1.2.132 (ISC/MIT), for household pictograms missing
  from Gravity UI, and for the `wx-*` aliases: the weather's eleven icons and
  the house on Energy's header chart, all Lucide so that one family draws the
  weather.
- `@iconify-json/ph` 1.2.2 (Phosphor 2.1.1, MIT), for the `tab-*` aliases:
  the tab bar's four filled glyphs, from one family so they share a weight.
  Neither of the other two has a filled thermometer or car.

Only the 64 named aliases are bundled. Upstream SVG bodies and view boxes are
preserved, with no fonts, assets or runtime network dependencies. The class
input is sanitized. `check:icons` verifies byte-for-byte deterministic
regeneration.

Redistribution notices ship as `vendor/LICENSE.Gravity-Icons.txt`,
`vendor/LICENSE.Lucide-Icons.txt` and `vendor/LICENSE.Phosphor-Icons.txt`,
copied from the respective upstream projects.
The alias map is the source of truth for changing a glyph; edit that map and
rebuild instead of editing generated SVG paths.
