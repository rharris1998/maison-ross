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
