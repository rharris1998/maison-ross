# Ross Home

Ross's Home Assistant wall-panel dashboard: one custom element,
`custom:ross-home`, for a panel view. Plain JavaScript and CSS, no framework,
no build dependencies.

It reads states from the `hass` object Home Assistant gives every card, so it
runs under your own login: no long-lived token and nothing served outside
Home Assistant's authentication.

## Design

After u/Potential-Cod-1851's Wall Panel Design Language: one big number per
card (Unbounded 500) with small dim labels (Plus Jakarta Sans); calm until
something needs you, amber for attention and red to act now; a colour per role
that glows only while active (solar #fbbf24, OK #34d399, home #38bdf8, grid
#94a3b8, EV #2dd4bf, accent #8d7bff, heat #ff8c1a, act #ff5d7a); 26 px frosted
cards; 56-70 px touch targets; a second tap for risky actions; detail in large
rounded sheets. Dark (#080b11) and light (#eef3f8) switch at sunset and
sunrise, or pick one with the header button. Reduced motion is respected.

## What it shows

- Header: greeting, who's home, weather, status, theme, clock.
- Bedroom air: PM2.5, filter life and the purifier, with a sheet for mode, speed, display and child lock.
- Weather: now and five days.
- Quick actions: purifier, sleep mode, floodlight, motion alerts, lights, cameras, backup, updates.
- Rooms: every area with lights, cameras, a purifier or a temperature; lit rooms glow.
- Front door and cameras: Ring snapshots, tap for live view.
- Shopping list: tick items off.

Every entity id has a default in `DEFAULTS` at the top of `src/ross-home.js`
and can be overridden in the card's YAML.

## Install with HACS

1. HACS → ⋮ → Custom repositories → `rharris1998/maison-ross`, type **Dashboard**.
2. Download **Ross Home**.
3. A dashboard with one panel view holding `type: custom:ross-home`.

## Develop

- `src/ross-home.js` is the whole dashboard.
- `preview/index.html` mocks Home Assistant with this house's states:
  `python3 -m http.server` at the repo root, then open `/preview/index.html`
  (query flags: `day=1`, `bulbs=1`, `todo=1`, `update=1`, `filter=8`,
  `garden=unavailable`, `ding=1`).
- Every push to `main` builds `dist/maison-ross.js` and publishes a release
  that HACS offers as an update.

## History

Versions 1.x were a fork of [bnlqn/maison](https://github.com/bnlqn/maison)
(MIT). Its code is still under `config/`, `frontend/` and `tools/` for
reference; the release no longer uses it.


## House view

The house button in the header opens a cut-away 3D model of the house
(three floors, traced from the estate agent's floorplan in `src/house-plan.js`).
Rooms glow while their lights are on, the sky follows `sun.sun` and the weather,
and devices are pinned where they are: tap a light to toggle it (hold for its
details), a camera for its live view, the purifier for its sheet, or a room for
everything in it.

*Place devices* lets you drag pins into place, remove them or add more from the
tray; *Save* writes the layout into this card's settings (`house_layout`,
`house_hidden`) so every screen sees it. Other options:

| Option | Default | |
|---|---|---|
| `start_view` | — | `house` opens the house view on load (for a wall tablet) |
| `house_floor` | `ground` | floor shown first: `ground`, `first` or `loft` |
| `house_north` | `0` | degrees to turn the sun so its shadows match the real house |

three.js r169 is vendored in `vendor/three` and bundled into the release by
`tools/build-ross-home.mjs` (esbuild).
