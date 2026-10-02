// Maison's design tokens (#29): the only place a colour, a type size, a radius
// or a duration is written down. Every Maison rule reads them as
// var(--m-…); tests/maison-styles.test.mjs fails on a colour literal or a font
// size anywhere else. Keys are custom property names without the leading
// "--". The dark colours are the approved concept's; the light ones are
// Apple's light system colours, with two changes for contrast: secondary text
// is .75 rather than .60 (4.8:1 on the page), and the focus ring is opaque.
// The *-text colours are the ones a figure or label in that colour takes.
// In light they are darkened to pass 4.5:1 on white; on the grey page
// (#F2F2F7) yellow text reads 4.44:1. The pressable blue is Apple's accessible
// #0066CC rather than the system #007AFF (Alex, 30/09): about 5:1 on the page
// and 4.6:1 in a tinted button on a card. In dark it is #5AB0FF, 4.6:1 in a
// tinted button on a sheet's card. The fills keep the system blues. The host follows Home Assistant's theme
// through the `dark` attribute the element's applyTheme() sets. TEMP_SCALE
// and SKY are the colours a component computes with (a capsule's fill, the
// sky's gradient) rather than reads as a custom property.

// false would make Maison dark-only, whatever Home Assistant's theme.
export const THEMED = true;

// The same in both schemes.
export const SHARED = {
  // The temperature scale, for rooms only: cold to hot.
  'm-temp-1': '#5AC8FA', 'm-temp-2': '#7DD8C8', 'm-temp-3': '#FFD60A', 'm-temp-4': '#FF9F0A', 'm-temp-5': '#FF6B3D', 'm-temp-6': '#FF453A',
  'm-font': 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
  'm-font-rounded': 'ui-rounded,system-ui,-apple-system,BlinkMacSystemFont,sans-serif',
  // The only text sizes there are, each a whole `font` shorthand.
  'm-type-large-title': '700 34px/41px var(--m-font)',
  'm-type-title': '700 22px/28px var(--m-font)',
  'm-type-headline': '600 17px/22px var(--m-font)',
  'm-type-body': '400 17px/22px var(--m-font)',
  'm-type-subhead': '400 15px/20px var(--m-font)',
  'm-type-subhead-strong': '600 15px/20px var(--m-font)',
  'm-type-footnote': '400 13px/18px var(--m-font)',
  'm-type-footnote-strong': '600 13px/18px var(--m-font)',
  // Tab labels and chart axes only.
  'm-type-caption': '600 11px/13px var(--m-font)',
  // A reading set as a figure: a stepper's value, a row's reading. Rounded;
  // add font-variant-numeric:tabular-nums after it, as the shorthand resets it.
  'm-type-figure': '600 22px/28px var(--m-font-rounded)',
  // Two figure sizes for numbers only, never words: a header's main figure
  // (the Energy price), and the weather's temperature, the one display figure.
  'm-type-figure-large': '600 44px/48px var(--m-font-rounded)',
  'm-type-display': '200 96px/96px var(--m-font)',
  'm-radius-screen': '46px', 'm-radius-sheet': '38px', 'm-radius-card': '24px', 'm-radius-row': '12px',
  'm-radius-tile': '9px', 'm-radius-segment': '9px', 'm-radius-capsule': '999px',
  'm-space-1': '4px', 'm-space-2': '8px', 'm-space-3': '12px', 'm-space-4': '16px',
  'm-space-5': '20px', 'm-space-6': '24px', 'm-space-7': '32px', 'm-space-8': '40px',
  // The frame overrides the page inset per layout.
  'm-card-padding': '16px', 'm-content-max': '1120px', 'm-page-inset': '16px',
  'm-control': '36px', 'm-control-large': '44px', 'm-hit': '44px',
  'm-row-min': '58px', 'm-tile': '32px',
  // The widget grid from 700px (#29 step 4): its row height and its gap.
  // today.js's WIDGET_ROWS follows from the row, as widget.css.js explains.
  'm-widget-row': '168px', 'm-widget-gap': '16px',
  // The thumb's size; --m-switch-thumb is its colour, in LIGHT and DARK.
  'm-switch-w': '51px', 'm-switch-h': '31px', 'm-switch-thumb-size': '27px',
  'm-segment-h': '32px',
  'm-tabbar-height': '64px', 'm-tab-top-height': '38px', 'm-tabbar-top': '12px',
  // How far the sky reaches up behind the pill from 700 px: its top gap, a
  // tab, 5 px of padding twice and its two .5 px borders.
  'm-tabbar-reach': 'calc(var(--m-tabbar-top) + var(--m-tab-top-height) + 11px)',
  // The page's own background, read on the host: inside the hero --m-bg is
  // the dark one, so the sky fades into this instead.
  'm-page-bg': 'var(--m-bg)',
  // Text on the sky, the scrim behind the weather's days, and the height of
  // the band where the sky fades into the page.
  'm-sky-shadow': '0 1px 2px rgba(0,0,0,.28)', 'm-sky-scrim': 'rgba(0,0,0,.22)', 'm-sky-fade': '56px',
  // Secondary text on the sky: white at .85, as Apple Weather draws it,
  // rather than the page's grey at .62, which reads at 4.5:1 only on a near
  // black sky. The hero takes it as its --m-label-2.
  'm-sky-label-2': 'rgba(255,255,255,.85)',
  // The focus ring on the sky: white, which the sky's contrast test already
  // holds to 4.5:1 wherever text sits. The dark set's translucent blue reads
  // at about 1.5:1 on a day sky.
  'm-sky-focus-ring': '#FFFFFF',
  // The header charts' own colours. They sit on the sky, so they are the same
  // in both schemes.
  'm-capsule-track': 'rgba(255,255,255,.14)', 'm-target-tick': '#FFFFFF',
  'm-link-idle': 'rgba(255,255,255,.26)',
  'm-node-fill': 'rgba(255,255,255,.13)', 'm-node-fill-idle': 'rgba(255,255,255,.06)', 'm-node-ring-idle': 'rgba(255,255,255,.2)',
  'm-car-body-day': '#EEF0F3', 'm-car-body-night': '#9EA4B1', 'm-car-window-day': '#27324A', 'm-car-window-night': '#141C2B',
  'm-car-tyre': '#0D0E12', 'm-car-hub': '#8D929E', 'm-car-cable': '#D1D1D6', 'm-car-shadow': 'rgba(0,0,0,.55)', 'm-car-led-off': '#636366',
  'm-glass-blur': 'blur(22px) saturate(180%)',
  // A glyph on a bright tone's dot, such as a glance chip's yellow or green:
  // black, as white on yellow reads at under 2:1.
  'm-on-bright': '#000000',
  'm-ease': 'cubic-bezier(.32,.72,0,1)', 'm-dur-press': '120ms', 'm-dur-control': '240ms', 'm-dur-sheet': '380ms',
  'm-z-tabbar': '9', 'm-z-sheet': '100', 'm-z-toast': '110',
};

// The colours and shadows that change with the scheme. LIGHT and DARK have
// the same keys, in the same order.
export const LIGHT = {
  'm-label': '#000000', 'm-label-2': 'rgba(60,60,67,.75)', 'm-label-3': 'rgba(60,60,67,.30)', 'm-separator': 'rgba(60,60,67,.29)',
  'm-bg': '#F2F2F7', 'm-card-fill': '#FFFFFF', 'm-card-border': 'transparent',
  'm-fill-gray': 'rgba(120,120,128,.12)', 'm-fill-pressed': 'rgba(120,120,128,.20)',
  'm-blue': '#007AFF', 'm-blue-text': '#0066CC', 'm-blue-fill': 'rgba(0,122,255,.15)', 'm-blue-fill-pressed': 'rgba(0,122,255,.25)',
  'm-yellow': '#FFCC00', 'm-yellow-text': '#946800', 'm-indigo': '#5856D6', 'm-indigo-text': '#5856D6', 'm-pink': '#FF2D55',
  'm-green': '#34C759', 'm-green-text': '#1F7A36', 'm-orange': '#FF9500', 'm-orange-text': '#C93400', 'm-orange-fill': 'rgba(255,149,0,.15)', 'm-gray': '#8E8E93', 'm-on-color': '#FFFFFF',
  'm-switch-off': 'rgba(120,120,128,.16)', 'm-switch-thumb': '#FFFFFF', 'm-switch-thumb-shadow': '0 3px 8px rgba(0,0,0,.15),0 1px 1px rgba(0,0,0,.06)',
  'm-segment-thumb': '#FFFFFF', 'm-segment-thumb-shadow': '0 3px 8px rgba(0,0,0,.12),0 3px 1px rgba(0,0,0,.04)',
  'm-glass-top': 'rgba(255,255,255,.82)', 'm-glass-bottom': 'rgba(255,255,255,.62)', 'm-glass-border': 'rgba(0,0,0,.08)',
  'm-glass-highlight': 'inset 0 1px 0 rgba(255,255,255,.9)', 'm-glass-shadow': '0 12px 34px rgba(0,0,0,.14)',
  'm-glass-shadow-small': '0 2px 8px rgba(0,0,0,.08)',
  'm-glass-selected': 'rgba(0,0,0,.06)', 'm-glass-fallback': 'rgba(249,249,249,.97)',
  'm-scrim': 'rgba(0,0,0,.20)', 'm-sheet-fill': '#F2F2F7', 'm-focus-ring': '#007AFF',
};
export const DARK = {
  'm-label': '#FFFFFF', 'm-label-2': 'rgba(235,235,245,.62)', 'm-label-3': 'rgba(235,235,245,.34)', 'm-separator': 'rgba(84,84,88,.55)',
  'm-bg': '#000000', 'm-card-fill': 'rgba(255,255,255,.075)', 'm-card-border': 'rgba(255,255,255,.09)',
  'm-fill-gray': 'rgba(255,255,255,.13)', 'm-fill-pressed': 'rgba(255,255,255,.20)',
  'm-blue': '#0A84FF', 'm-blue-text': '#5AB0FF', 'm-blue-fill': 'rgba(10,132,255,.22)', 'm-blue-fill-pressed': 'rgba(10,132,255,.34)',
  'm-yellow': '#FFD60A', 'm-yellow-text': '#FFD60A', 'm-indigo': '#5E5CE6', 'm-indigo-text': '#7D7AFF', 'm-pink': '#FF375F',
  'm-green': '#30D158', 'm-green-text': '#30D158', 'm-orange': '#FF9F0A', 'm-orange-text': '#FF9F0A', 'm-orange-fill': 'rgba(255,159,10,.18)', 'm-gray': '#8E8E93', 'm-on-color': '#FFFFFF',
  'm-switch-off': 'rgba(120,120,128,.32)', 'm-switch-thumb': '#FFFFFF', 'm-switch-thumb-shadow': '0 3px 8px rgba(0,0,0,.3),0 1px 1px rgba(0,0,0,.16)',
  'm-segment-thumb': '#636366', 'm-segment-thumb-shadow': '0 3px 8px rgba(0,0,0,.12),0 3px 1px rgba(0,0,0,.04)',
  'm-glass-top': 'rgba(255,255,255,.16)', 'm-glass-bottom': 'rgba(255,255,255,.06)', 'm-glass-border': 'rgba(255,255,255,.22)',
  'm-glass-highlight': 'inset 0 1px 0 rgba(255,255,255,.28)', 'm-glass-shadow': '0 12px 34px rgba(0,0,0,.45)',
  'm-glass-shadow-small': '0 2px 8px rgba(0,0,0,.30)',
  'm-glass-selected': 'rgba(255,255,255,.16)', 'm-glass-fallback': 'rgba(30,30,30,.97)',
  'm-scrim': 'rgba(0,0,0,.48)', 'm-sheet-fill': '#1C1C1E', 'm-focus-ring': 'rgba(10,132,255,.7)',
};

// The temperature scale as [°C, colour] stops, cold to hot: m-temp-1…6's
// colours at the readings they stand for. The zone capsules interpolate on it.
export const TEMP_SCALE = Object.freeze([[16, '#5AC8FA'], [19, '#7DD8C8'], [21, '#FFD60A'], [23, '#FF9F0A'], [25, '#FF6B3D'], [26.5, '#FF453A']]
  .map(stop => Object.freeze(stop)));

// The sky's keyframes: four stops each, top to bottom, which sky-model.js
// interpolates by the sun's elevation (night from −14°, twilight at −2°, day
// from 10°) and blends, by day, toward the weather's own sky: `overcast` for
// cloud and rain, `mist` for fog, `snowfall` for snow, and `storm` in a
// thunderstorm (`overcastNight` for all of them by night); `unknown` is the
// calm slate while the sun is unknown. The same in both schemes: the sky
// follows the hour and the weather, never Home Assistant's theme. White text
// and --m-sky-label-2 read at 4.5:1 on each, and the model caps the light it
// lays over them to keep that (tests/maison-sky-paint.test.mjs).
// Then what is drawn on it, each colour's alpha its most before the model's
// contrast cap: clouds by day and by night, and storm clouds; stars; the
// sun's glow and its disc; the warm horizon at twilight; rain, snow and
// hail; fog's haze.
export const SKY = Object.freeze({
  night: Object.freeze(['#02040B', '#060D26', '#0B1839', '#12244C']),
  twilight: Object.freeze(['#15204F', '#2C316E', '#5A3E73', '#8A4A5E']),
  day: Object.freeze(['#093A88', '#12519F', '#1A62AE', '#1C66AA']),
  overcast: Object.freeze(['#3A4B5E', '#435468', '#4B5C70', '#536477']),
  overcastNight: Object.freeze(['#0A0D14', '#10141D', '#161B26', '#1C2230']),
  mist: Object.freeze(['#545E68', '#58626C', '#5A646E', '#5C6670']),
  snowfall: Object.freeze(['#4C6280', '#4F6581', '#516781', '#536881']),
  storm: Object.freeze(['#1E2631', '#262F3B', '#2E3745', '#353F4E']),
  unknown: Object.freeze(['#1C2230', '#232A3A', '#2A3244', '#30394C']),
  cloudDay: 'rgba(255,255,255,.55)', cloudNight: 'rgba(92,108,156,.45)', cloudStorm: 'rgba(10,13,20,.5)',
  star: '#FFFFFF', sunGlow: 'rgba(255,246,214,.55)', horizonWarm: 'rgba(255,159,107,.5)',
  rain: 'rgba(200,220,255,.55)', snow: 'rgba(255,255,255,.7)', hail: 'rgba(235,240,255,.9)', fog: 'rgba(196,204,214,.5)',
});

// Tokens as declarations: {'m-bg': '#000000'} → "--m-bg:#000000".
const declarations = tokens => Object.entries(tokens).map(([name, value]) => `--${name}:${value}`).join(';');

// Declared on the host, the dark set while it carries `dark`. The hero
// draws on the dark set in both schemes, as it sits on the sky: its text,
// its tools' glass and its charts, with the sky's own secondary text and
// focus ring. Reduced motion zeroes every duration; `.m-num` sets a figure
// in the rounded face with tabular digits.
export const tokenStyles = `
:host{${declarations(SHARED)};${declarations(THEMED ? LIGHT : DARK)};color-scheme:${THEMED ? 'light' : 'dark'}}
${THEMED ? `:host([dark]){${declarations(DARK)};color-scheme:dark}` : ''}
:host .m-hero{${declarations(DARK)};--m-label-2:var(--m-sky-label-2);--m-focus-ring:var(--m-sky-focus-ring);color-scheme:dark}
@media (prefers-reduced-motion:reduce){:host{--m-dur-press:0ms;--m-dur-control:0ms;--m-dur-sheet:0ms}}
.m-num{font-family:var(--m-font-rounded);font-variant-numeric:tabular-nums}
`;
