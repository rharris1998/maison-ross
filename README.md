# Maison

A Home Assistant dashboard built as a single custom element: one panel view,
no HACS cards. It follows Home Assistant's light or dark mode and lays itself
out for phone, tablet and desktop.

This is a reference, not a plug-and-play card. It was written for one house:
about 140 entity IDs, the heating zones, the calendars and the scripts it calls
are set in `config/www/maison/model.js`, and several of the numbers it shows
come from template sensors and scripts in that house's own Home Assistant
configuration, which aren't part of this repository. Read it, borrow from it,
adapt it.

The people in the code and fixtures (Alex, Sam, Noah) are made up.

## Pages

- **Today**: weather, what needs attention, calendars and bin collections, the
  car, power right now and today's energy.
- **Energy**: live flow between solar, grid, house and car, the all-in price of
  the next kWh, billing-year credit per tariff register, the bill so far, and
  today's power since midnight with the rest of the day's solar forecast.
- **Car**: charge level with reserve and limit, why it is or isn't charging,
  charge now, the charge limit and automatic charging.
- **Climate**: the house thermostat and each heating zone, with schedules,
  overrides, away and towel-rail drying.
- **Home status**: alerts, key devices, vacuum maintenance and a searchable
  list of every sensor.

The header sky is drawn from `sun.sun` and the weather entity. A missing reading
shows as a dash, never as 0.

## What's where

- `config/www/maison/`: the served modules. `maison-dashboard.js` is the custom
  element; `screen.js`, `today.js`, `energy.js`, `car.js`, `climate.js`,
  `system.js` and `sky.js` turn states into what each page shows; `model.js`
  maps the house's entities; `guard.js` decides which writes are allowed.
  `vendor/` holds the built React bundles and their licenses.
- `frontend/maison/`: the React source, fixtures, build scripts and Playwright
  specs. Its [README](frontend/maison/README.md) covers the architecture.
- `config/dashboards/maison-dashboard.yaml`: the dashboard, one panel view
  holding `custom:maison-dashboard`.
- `tools/maison-preview.mjs` and `dev/maison/`: a local preview with no Home
  Assistant connection.
- `tests/`: the Node test suites.
- `docs/adr/`: three design decisions.

## What it expects from Home Assistant

- **Entities**: the ones named in `model.js`. Anything missing shows as a dash
  or "Not set up yet".
- **Scripts**, for every write: `heating_zone_override`,
  `heating_zone_override_cancel`, `house_heating_override_set`,
  `house_heating_override_cancel`, `house_heating_away_set`,
  `house_heating_away_cancel`, `house_heating_warm_until`,
  `towel_rail_drying_start`, `towel_rail_drying_stop`, `tesla_charge_now`,
  `tesla_charge_automatic` and `tesla_charge_refresh`.
- **Services and APIs** it reads through: weather forecasts, schedules,
  calendars and the recorder's history.

## Install

1. Copy `config/www/maison/` to `/config/www/maison/` on your Home Assistant.
2. Add `/local/maison/maison-dashboard.js?v=38` as a dashboard resource of type
   JavaScript module.
3. Create a dashboard and paste `config/dashboards/maison-dashboard.yaml` into
   its raw configuration editor.

Every file of a release carries the same `?v=` stamp, and a test checks that
they match. Bump all of them together when you change anything.

## Build, preview and test

Built and tested with Node 24.

```sh
cd frontend/maison
npm ci
npm run build   # npm run check verifies the bundles match the source
```

From the repository root:

```sh
node --test tests/maison-*.test.mjs
node tools/maison-preview.mjs --port 8766
```

The preview serves `http://localhost:8766/` and the component gallery at
`/gallery`. Add `--snapshot states.json` (a saved `/api/states` response) to
preview real states: attributes are filtered and controls are simulated.

The Playwright visual baselines aren't included. The first
`npm run test:visual -- --update-snapshots` in `frontend/maison` records them.

## How it was made

Built with Claude Code over about four weeks in September and October 2026.
Features were specified as issues, the main decisions are recorded in
`docs/adr/`, and every change and every visual baseline was reviewed by hand
before it shipped.

## License

MIT, see [LICENSE](LICENSE). The bundled third-party code keeps its own
licenses, listed in `config/www/maison/vendor/`.
