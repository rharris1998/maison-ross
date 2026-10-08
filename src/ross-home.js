// Ross Home: a wall-panel dashboard for Ross's Home Assistant.
//
// One custom element, `custom:ross-home`, for a panel view. It reads states
// from the `hass` object Home Assistant hands every card, so it uses the
// signed-in user's own session: no long-lived token, nothing served outside
// Home Assistant's login. Plain JavaScript and CSS, no framework.
//
// Design language (after u/Potential-Cod-1851's "Wall Panel Design
// Language"): one big number per card in Unbounded, small dim labels in Plus
// Jakarta Sans; calm until something needs you (amber attention, red act
// now); a colour per role that glows only while active; 26 px frosted cards;
// 56–70 px touch targets; a second tap for risky actions; detail in large
// rounded sheets. Dark (#080b11) and light (#eef3f8) switch at sunset and
// sunrise. Motion is slow and respects reduced motion.

import {HouseView} from './ross-house.js';

const VERSION = '__VERSION__';

// Ross's house. Every id can be overridden from the card's YAML.
const DEFAULTS = Object.freeze({
  weather: 'weather.forecast_home',
  sun: 'sun.sun',
  purifier: 'fan.bedroom_purifier',
  purifier_name: 'Bedroom purifier',
  air_quality: 'sensor.core_300s_series_air_quality',
  pm25: 'sensor.core_300s_series_pm2_5',
  filter_life: 'sensor.core_300s_series_filter_lifetime',
  purifier_display: 'switch.core_300s_series_display',
  purifier_child_lock: 'switch.core_300s_series_child_lock',
  doorbell: 'camera.front_door_live_view',
  doorbell_activity: 'sensor.front_door_last_activity',
  // Turned on by an Alexa routine the moment the Ring is pressed.
  doorbell_press: 'input_boolean.doorbell_pressed',
  floodlight: 'light.garden_light',
  motion_alerts: 'switch.garden_motion_detection',
  cameras: [
    {name: 'Front door', camera: 'camera.front_door_live_view', activity: 'sensor.front_door_last_activity', battery: 'sensor.front_door_battery'},
    {name: 'Garden', camera: 'camera.garden_live_view', activity: 'sensor.garden_last_activity', battery: 'sensor.garden_battery'},
    {name: 'Living room', camera: 'camera.living_room_live_view', activity: 'sensor.living_room_last_activity', battery: 'sensor.living_room_battery'},
    {name: 'Dining room', camera: 'camera.dining_room_live_view', activity: 'sensor.dining_room_last_activity', battery: 'sensor.dining_room_battery'},
  ],
  todo: 'todo.shopping_list',
  bins: 'calendar.waste_collection_schedule_london_borough_of_bexley',
  calendar: 'calendar.evie_ross',
  energy_usage: 'sensor.dcc_sourced_smart_electricity_meter_usage_today',
  energy_cost: 'sensor.dcc_sourced_smart_electricity_meter_cost_today',
  energy_rate: 'sensor.dcc_sourced_smart_electricity_meter_rate',
  energy_standing: 'sensor.dcc_sourced_smart_electricity_meter_standing_charge',
  water: 'sensor.thames_water_meter_thames_water_sensor',
  water_rate: 'sensor.thames_water_tariff_thames_water_volumetric_rate',
  // Events left off the calendar card (bins have their own row).
  calendar_hide: '^bin day',
  backup: 'sensor.backup_last_successful_automatic_backup',
  remote: 'binary_sensor.remote_ui',
  phone_battery: 'sensor.rosss_iphone_battery_level',
  // Lights that are outdoor or security lights and stay out of Rooms' count.
  exclude_lights: ['light.garden_light'],
});

// Bins: the council names each one "Brown Caddy (Food waste)".
const BIN_COLOURS = [[/brown/i, '#a8743f'], [/white/i, '#e8edf3'], [/blue/i, '#38bdf8'], [/green/i, '#34d399'], [/black|grey|gray/i, '#64748b'], [/purple/i, '#8d7bff'], [/red/i, '#ff5d7a']];
const binInfo = (summary = '') => {
  const m = summary.match(/^(.*?)\s*\((.*)\)\s*$/);
  return {bin: m ? m[1] : summary, short: m ? m[2] : summary, colour: (BIN_COLOURS.find(([re]) => re.test(summary)) || [, '#94a3b8'])[1]};
};
const localDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const binDots = (items) => `<span class="bindots">${items.map((b) => `<span class="bindot" style="--c:${b.colour}" title="${esc(b.bin)}"></span>`).join('')}</span>`;
const binWhen = (d) => (d.away === 0 ? 'today' : d.away === 1 ? 'tomorrow' : d.away < 7 ? localDay(d.date).toLocaleDateString('en-GB', {weekday: 'long'}) : `in ${d.away} days`);

// ---- Line icons: 24 px grid, 2 px stroke, round caps ----------------------
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
  wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  sleep: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M17 3h3l-3 3h3"/>',
  camera: '<path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  door: '<path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14M2 20h20M14 12v.01"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/>',
  flood: '<path d="M8 3h8l2 6H6Z"/><path d="M12 9v4M7 16l-2 3M17 16l2 3M12 16v4"/>',
  motion: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  backup: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M12 12v9M8 16l4-4 4 4"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  list: '<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  kitchen: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
  sofa: '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0ZM4 18v2M20 18v2"/>',
  office: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  bath: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"/>',
  tree: '<path d="M12 22v-7M9 15h6M12 2 5 15h14Z"/>',
  dining: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  stairs: '<path d="M3 21h5v-5h5v-5h5V6h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  umbrella: '<path d="M22 12a10.06 10.06 1 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0M12 2v1"/>',
  bin: '<path d="M3 6h18M8 6V4h8v2"/><path d="M5 6l1.2 14a2 2 0 0 0 2 2h7.6a2 2 0 0 0 2-2L19 6M10 11v6M14 11v6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
  drop: '<path d="M12 22a7 7 0 0 0 7-7c0-4-7-13-7-13S5 11 5 15a7 7 0 0 0 7 7Z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
};
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.home}</svg>`;

// Coloured weather glyphs, the only coloured icons.
function weatherIcon(state, night = false) {
  const sun = '<circle cx="12" cy="12" r="4.2" fill="#fbbf24"/><g stroke="#fbbf24" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></g>';
  const moon = '<path d="M13 4a7 7 0 1 0 7 9.5A6 6 0 0 1 13 4Z" fill="#c7d2fe"/>';
  const cloud = (x = 0, y = 0, c = '#cbd5e1') => `<path transform="translate(${x} ${y})" d="M17 19H8.5a5 5 0 1 1 4.6-7h.9a3.5 3.5 0 1 1 3 7Z" fill="${c}"/>`;
  const drops = '<g stroke="#38bdf8" stroke-width="2" stroke-linecap="round"><path d="M9 20.5l-1 2M13 20.5l-1 2M17 20.5l-1 2"/></g>';
  const small = (inner) => `<g transform="translate(-3 -4) scale(.75)">${inner}</g>`;
  const glyph = {
    sunny: sun, 'clear-night': moon,
    partlycloudy: (night ? small(moon) : small(sun)) + cloud(2, 2),
    cloudy: cloud(-1, 1, '#94a3b8') + cloud(1, -2),
    fog: cloud(0, -2) + '<g stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><path d="M5 21h14"/></g>',
    rainy: cloud(0, -3) + drops, pouring: cloud(0, -3, '#94a3b8') + drops,
    'lightning-rainy': cloud(0, -3, '#94a3b8') + '<path d="M12 15l-2 4h3l-2 4" stroke="#fbbf24" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    lightning: cloud(0, -3, '#94a3b8') + '<path d="M12 15l-2 4h3l-2 4" stroke="#fbbf24" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    snowy: cloud(0, -3) + '<g fill="#e0f2fe"><circle cx="8" cy="21" r="1.2"/><circle cx="12" cy="22" r="1.2"/><circle cx="16" cy="21" r="1.2"/></g>',
    'snowy-rainy': cloud(0, -3) + drops, hail: cloud(0, -3) + drops,
    windy: '<g stroke="#94a3b8" stroke-width="2" fill="none" stroke-linecap="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2"/></g>',
    'windy-variant': cloud(0, -2),
    exceptional: '<circle cx="12" cy="12" r="8" fill="#ff5d7a"/>',
  }[state] || cloud();
  return `<svg class="wx" viewBox="0 0 24 24" aria-hidden="true">${glyph}</svg>`;
}
const WEATHER_WORDS = {
  sunny: 'Sunny', 'clear-night': 'Clear', partlycloudy: 'Partly cloudy', cloudy: 'Cloudy', fog: 'Fog', rainy: 'Rain', pouring: 'Heavy rain',
  'lightning-rainy': 'Thunderstorms', lightning: 'Lightning', snowy: 'Snow', 'snowy-rainy': 'Sleet', hail: 'Hail', windy: 'Windy',
  'windy-variant': 'Windy, cloudy', exceptional: 'Severe weather',
};

// ---- Helpers ----------------------------------------------------------------
const BAD = new Set(['unknown', 'unavailable', '', undefined, null]);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const num = (s) => (s && !BAD.has(s.state) && Number.isFinite(Number(s.state)) ? Number(s.state) : null);
const ok = (s) => !!s && !BAD.has(s.state);
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : '');
const pretty = (t) => cap(String(t ?? '').replaceAll('_', ' '));
const pad = (n) => String(n).padStart(2, '0');
function hhmm(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function ago(iso, now = Date.now()) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  const days = Math.round(m / 1440);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
function whenShort(iso, now = new Date()) {
  const d = new Date(Date.parse(iso || ''));
  if (Number.isNaN(d.getTime())) return '—';
  const same = d.toDateString() === now.toDateString();
  return same ? hhmm(d) : d.toLocaleDateString('en-GB', {weekday: 'short'}) + ' ' + hhmm(d);
}

// Areas a room tile shows, and the line icon each keyword gets.
const ROOM_ICONS = [[/kitchen/i, 'kitchen'], [/bed/i, 'bed'], [/living|lounge|front room/i, 'sofa'], [/office|study/i, 'office'],
  [/bath|shower|toilet|wc/i, 'bath'], [/garden|yard|outside/i, 'tree'], [/dining/i, 'dining'], [/porch|hall|entrance|door/i, 'door'], [/stair|landing/i, 'stairs']];
const roomIcon = (name) => (ROOM_ICONS.find(([re]) => re.test(name)) || [null, 'home'])[1];

let fontsRequested = false;
function requestFonts() {
  if (fontsRequested) return;
  fontsRequested = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Unbounded:wght@500;600&display=swap';
  document.head.appendChild(link);
}

// ---- Styles -----------------------------------------------------------------
const STYLES = `
:host{display:block;height:100%;
  --solar:#fbbf24;--ok:#34d399;--home:#38bdf8;--grid:#94a3b8;--ev:#2dd4bf;--accent:#8d7bff;--heat:#ff8c1a;--act:#ff5d7a;
  --ground:#080b11;--text:#eef2f7;--dim:#8d96a8;--card:rgba(255,255,255,.045);--card-line:rgba(255,255,255,.08);
  --tile:rgba(255,255,255,.05);--tile-line:rgba(255,255,255,.07);--shadow:none;--sheet:#0f141d;--scrim:rgba(3,5,9,.62);
  --num:'Unbounded','Plus Jakarta Sans',system-ui,sans-serif;--word:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif}
.root[data-theme=light]{--solar:#b7770c;--ok:#0f8a5f;--home:#1683c7;--grid:#64748b;--ev:#0d8f86;--accent:#6354b9;--heat:#c2571a;--act:#c53757;
  --ground:#eef3f8;--text:#152633;--dim:#4f6170;--card:#ffffff;--card-line:rgba(21,38,51,.06);--tile:#f3f6fa;--tile-line:rgba(21,38,51,.07);
  --shadow:0 1px 2px rgba(21,38,51,.04),0 8px 24px rgba(21,38,51,.06);--sheet:#f7f9fc;--scrim:rgba(21,38,51,.28)}
*{box-sizing:border-box}
.root{position:relative;min-height:100vh;background:var(--ground);color:var(--text);font-family:var(--word);font-weight:600;
  padding:18px 20px 22px;overflow:hidden;transition:background-color 1.2s ease,color 1.2s ease;-webkit-font-smoothing:antialiased}
.glow{position:absolute;inset:-20% -10% auto -10%;height:70%;pointer-events:none;opacity:.55;filter:blur(40px);
  background:radial-gradient(40% 50% at 18% 30%,var(--mood,rgba(56,189,248,.18)),transparent 70%),radial-gradient(35% 45% at 85% 10%,var(--mood2,rgba(141,123,255,.12)),transparent 70%);
  transition:opacity 2s ease}
.root[data-theme=light] .glow{opacity:.35}
.root.night{filter:brightness(.82)}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.wx{width:28px;height:28px;flex:none}
.num{font-family:var(--num);font-weight:500;letter-spacing:-.04em;line-height:1}
.unit{font-family:var(--num);font-weight:500;font-size:.42em;letter-spacing:0;margin-left:2px;color:var(--dim)}
.label{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}
.dim{color:var(--dim)}
.t-solar{color:var(--solar)}.t-ok{color:var(--ok)}.t-home{color:var(--home)}.t-accent{color:var(--accent)}.t-act{color:var(--act)}.t-ev{color:var(--ev)}.t-heat{color:var(--heat)}

/* Header */
header{position:relative;display:flex;align-items:center;gap:14px;margin-bottom:16px;flex-wrap:wrap}
.hello{flex:1 1 280px;min-width:0}
.hello h1{margin:0;font-family:var(--num);font-weight:600;font-size:30px;letter-spacing:-.03em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hello p{margin:4px 0 0;color:var(--dim);font-size:15px}
.pill{display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 16px;border-radius:999px;background:var(--card);border:1px solid var(--card-line);
  box-shadow:var(--shadow);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);font-size:15px;font-weight:700;white-space:nowrap}
.pill .wx{width:24px;height:24px}
.pill .num{font-size:17px}
.dot{width:9px;height:9px;border-radius:50%;background:var(--ok);flex:none}
.dot.amber{background:var(--solar)}.dot.red{background:var(--act)}.dot.off{background:var(--grid)}.dot.blue{background:var(--home)}
.people{display:flex;padding:0 8px}
.avatar{width:30px;height:30px;margin-left:-6px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;color:#fff;
  border:2px solid var(--ground);background:var(--accent)}
.avatar.away{background:var(--tile);color:var(--dim);border-color:var(--card-line)}
.iconbtn{width:48px;height:48px;justify-content:center;padding:0}
.clock{font-size:44px;margin-left:4px}

/* Grid */
.grid{position:relative;display:grid;gap:14px;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr);align-items:start}
.col{display:grid;gap:14px;min-width:0}
@media (max-width:1100px){.grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.col.c3{grid-column:1/-1;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}}
@media (max-width:720px){.root{padding:14px 12px 20px}.grid{grid-template-columns:1fr}.col.c3{grid-template-columns:1fr}
  .clock{font-size:34px}.hello h1{font-size:24px}.pill.wide{display:none}}

/* Cards */
.card{position:relative;border-radius:26px;background:var(--card);border:1px solid var(--card-line);box-shadow:var(--shadow);
  backdrop-filter:blur(22px) saturate(140%);-webkit-backdrop-filter:blur(22px) saturate(140%);padding:16px;min-width:0}
.card-h{display:flex;align-items:center;gap:10px;min-height:40px;margin-bottom:12px}
.card-h .label{flex:none}
.card-h .note{flex:1;min-width:0;text-align:right;font-size:14px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-h .note.solar{color:var(--solar)}
.go{width:40px;height:40px;flex:none;display:grid;place-items:center;border-radius:14px;background:var(--tile);border:1px solid var(--tile-line);color:var(--dim)}
.go .ic{width:18px;height:18px}

/* Air flow */
.flow{position:relative;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;justify-items:center;padding:6px 0 4px}
.flow{column-gap:10px}
.flow .wire{position:absolute;top:50%;left:18%;right:18%;z-index:0;height:2px;margin-top:-14px;
  background:repeating-linear-gradient(90deg,var(--wire,var(--grid)) 0 8px,transparent 8px 14px);opacity:.55}
.flow.live .wire{animation:flowdots 2.4s linear infinite}
@keyframes flowdots{to{background-position:28px 0}}
.node{position:relative;display:grid;justify-items:center;gap:6px;text-align:center;z-index:1}
.ring{position:relative;display:grid;place-items:center;border-radius:50%;background:var(--card);border:2px solid var(--c,var(--grid))}
.root[data-theme=dark] .ring{background:#0c1119}
.ring.big{width:118px;height:118px;border-width:3px}
.ring.big .num{font-size:30px}
.ring.small{width:64px;height:64px}
.ring.small .num{font-size:18px}
.ring.halo{box-shadow:0 0 0 7px color-mix(in srgb,var(--c) 16%,transparent),0 0 34px color-mix(in srgb,var(--c) 35%,transparent)}
.ring .sub{display:block;font-family:var(--word);font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--dim);margin-top:4px;text-transform:uppercase}
.node .label{font-size:11px}
.node .state{font-size:13px;color:var(--dim);margin-top:-2px}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}
.stat{border-radius:16px;background:var(--tile);border:1px solid var(--tile-line);padding:10px 12px;min-width:0}
.stat .label{font-size:10.5px}
.stat .v{font-size:15px;font-weight:700;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* Weather */
.wx-now{position:relative;display:flex;align-items:center;gap:14px}
.wx-now>div{min-width:0}
.wx-now .cond,.wx-now .hl{white-space:nowrap}
.wx-now .wx{width:56px;height:56px}
.wx-now .num{font-size:64px}
.wx-now .num sup{font-size:.4em;vertical-align:top;margin-left:2px}
.wx-now .cond{font-size:18px;font-weight:700}
.wx-now .hl{font-size:14px;color:var(--dim);margin-top:2px}
.chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;background:var(--tile);border:1px solid var(--tile-line);font-size:13px;font-weight:700;white-space:nowrap}
.chip .ic{width:15px;height:15px}
.chip.ok{color:var(--ok);background:color-mix(in srgb,var(--ok) 14%,transparent);border-color:transparent}
.chip.amber{color:var(--solar);background:color-mix(in srgb,var(--solar) 14%,transparent);border-color:transparent}
.chip.red{color:var(--act);background:color-mix(in srgb,var(--act) 14%,transparent);border-color:transparent}
.wx-now .chip{position:absolute;top:0;right:0}
.days{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:14px}
.day{border-radius:16px;background:var(--tile);border:1px solid var(--tile-line);padding:10px 4px;text-align:center;display:grid;justify-items:center;gap:6px}
.day .d{font-size:13px;color:var(--dim)}
.day .hi{font-family:var(--num);font-weight:500;font-size:16px}
.day .lo{font-size:12px;color:var(--dim)}
.day .rain{font-size:11px;color:var(--home);font-weight:700}

/* Tiles */
.tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
@media (max-width:720px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
.tile{position:relative;display:grid;align-content:space-between;gap:12px;min-height:96px;padding:12px;border-radius:20px;text-align:left;
  background:var(--tile);border:1px solid var(--tile-line);transition:background-color .6s ease,border-color .6s ease,box-shadow .6s ease}
.tile .badge{width:40px;height:40px;border-radius:14px;display:grid;place-items:center;background:var(--card);border:1px solid var(--tile-line);color:var(--dim)}
.root[data-theme=dark] .tile .badge{background:rgba(255,255,255,.05)}
.tile .name{font-size:15px;font-weight:700;line-height:1.2}
.tile .st{font-size:13px;color:var(--dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile.on{--c:var(--home);background:color-mix(in srgb,var(--c) 13%,var(--tile));border-color:color-mix(in srgb,var(--c) 55%,transparent);
  box-shadow:0 0 24px color-mix(in srgb,var(--c) 14%,transparent)}
.tile.on .badge{background:var(--c);border-color:transparent;color:#fff;box-shadow:0 6px 18px color-mix(in srgb,var(--c) 40%,transparent)}
.tile.on .st{color:var(--c)}
.tile.armed{border-color:var(--act);background:color-mix(in srgb,var(--act) 12%,var(--tile))}
.tile.armed .st{color:var(--act)}
.tile:active{transform:scale(.98)}

/* Rooms */
.rooms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (max-width:720px){.rooms{grid-template-columns:1fr}}
.room{display:flex;align-items:center;gap:12px;min-height:72px;padding:10px 10px 10px 12px;border-radius:20px;background:var(--tile);border:1px solid var(--tile-line);text-align:left;transition:all .6s ease}
.room .badge{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--card);border:1px solid var(--tile-line);color:var(--dim);flex:none}
.root[data-theme=dark] .room .badge{background:rgba(255,255,255,.05)}
.room .txt{flex:1;min-width:0}
.room .name{font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.room .st{font-size:13px;color:var(--dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.room .bulb{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;flex:none;background:var(--card);border:1px solid var(--tile-line);color:var(--dim)}
.room.lit{background:color-mix(in srgb,var(--solar) 11%,var(--tile));border-color:color-mix(in srgb,var(--solar) 50%,transparent)}
.room.lit .st{color:var(--solar)}
.room.lit .bulb{background:linear-gradient(160deg,#fcd34d,#f5a524);color:#3b2a05;border-color:transparent;box-shadow:0 8px 22px rgba(251,191,36,.35)}
.empty{display:flex;align-items:center;gap:14px;padding:16px;border-radius:20px;border:1px dashed var(--tile-line);color:var(--dim);font-size:14px;line-height:1.4}
.empty .ic{width:28px;height:28px}

/* Front door */
.door-now{display:flex;align-items:flex-end;gap:14px}
.door-now .num{font-size:56px}
.door-now .sub{font-size:14px;color:var(--dim);margin-top:6px}
.snap{position:relative;display:block;width:100%;aspect-ratio:16/9;border-radius:18px;overflow:hidden;background:var(--tile);border:1px solid var(--tile-line)}
.snap img{width:100%;height:100%;object-fit:cover;display:block}
.snap .cap{position:absolute;left:10px;bottom:10px;max-width:calc(100% - 20px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:inline-flex;gap:6px;align-items:center;padding:5px 10px;border-radius:999px;
  background:rgba(8,11,17,.62);color:#eef2f7;font-size:12.5px;font-weight:700;backdrop-filter:blur(8px)}
.snap .cap .dot{width:7px;height:7px}
.snap.off img{filter:grayscale(1) brightness(.6)}
.door-snap{margin-top:12px}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.row .chip{height:40px;padding:0 14px}
.cams{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}

/* To do */
.task{display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 8px 8px 14px;border-radius:18px;background:var(--tile);border:1px solid var(--tile-line);margin-top:8px}
.task:first-child{margin-top:0}
.task .txt{flex:1;min-width:0}
.task .name{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.task .st{font-size:13px;color:var(--dim)}
.tick{width:44px;height:44px;border-radius:50%;border:2px solid var(--tile-line);display:grid;place-items:center;color:transparent;flex:none}
.tick:hover{color:var(--dim)}
.task.done .tick{background:var(--ok);border-color:var(--ok);color:#fff}
.task.done .name{text-decoration:line-through;color:var(--dim)}

/* Sheets */
.layer{position:fixed;inset:0;z-index:20;display:grid;place-items:center;padding:24px;background:var(--scrim);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:fade .25s ease}
.sheet{width:min(980px,100%);max-height:calc(100vh - 48px);overflow:auto;border-radius:32px;background:var(--sheet);border:1px solid var(--card-line);
  box-shadow:0 30px 80px rgba(0,0,0,.35);padding:22px;animation:rise .32s cubic-bezier(.2,.8,.2,1)}
@media (max-width:720px){.layer{padding:0;place-items:end stretch}.sheet{max-height:100vh;height:100%;border-radius:0;padding:16px}}
@keyframes fade{from{opacity:0}}
@keyframes rise{from{opacity:0;transform:translateY(18px) scale(.985)}}
.sheet-h{display:flex;align-items:center;gap:16px;margin-bottom:18px}
.sheet-h .big{width:64px;height:64px;border-radius:20px;display:grid;place-items:center;color:#fff;flex:none;
  background:linear-gradient(160deg,color-mix(in srgb,var(--c,var(--home)) 80%,#fff),var(--c,var(--home)));box-shadow:0 10px 30px color-mix(in srgb,var(--c,var(--home)) 35%,transparent)}
.sheet-h .big .ic{width:28px;height:28px}
.sheet-h h2{margin:0;font-family:var(--num);font-weight:600;font-size:26px;letter-spacing:-.03em}
.sheet-h .line{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:15px}
.sheet-h .line b{font-weight:700}
.sheet-h .x{margin-left:auto;width:56px;height:56px;border-radius:18px;display:grid;place-items:center;background:var(--tile);border:1px solid var(--tile-line);color:var(--dim)}
.sheet-body{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr);gap:14px}
@media (max-width:720px){.sheet-body{grid-template-columns:1fr}}
.panel{border-radius:24px;background:var(--card);border:1px solid var(--card-line);padding:16px}
.panel h3{margin:0 0 4px;font-size:17px;font-weight:700}
.panel .hint{font-size:13px;color:var(--dim);margin-bottom:12px}
.seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;padding:4px;border-radius:18px;background:var(--tile);border:1px solid var(--tile-line)}
.seg button{min-height:56px;border-radius:14px;display:grid;place-items:center;align-content:center;gap:4px;font-size:14px;font-weight:700;color:var(--dim);transition:all .3s ease}
.seg button .ic{width:18px;height:18px}
.seg button.sel{color:#fff;background:var(--c,var(--home));box-shadow:0 6px 18px color-mix(in srgb,var(--c,var(--home)) 35%,transparent)}
.seg button:disabled{opacity:.4;cursor:default}
.field{margin-top:16px}
.field .label{display:block;margin-bottom:8px}
.toggle-row{display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 12px;border-radius:18px;background:var(--tile);border:1px solid var(--tile-line);margin-top:8px;width:100%;text-align:left}
.toggle-row .badge{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:var(--card);color:var(--dim);flex:none}
.toggle-row .txt{flex:1}
.toggle-row .name{font-size:15px;font-weight:700}
.toggle-row .st{font-size:13px;color:var(--dim)}
.switch{width:52px;height:32px;border-radius:999px;background:var(--grid);opacity:.5;position:relative;flex:none;transition:all .3s ease}
.switch::after{content:'';position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;transition:transform .3s ease}
.switch.on{background:var(--c,var(--ok));opacity:1}
.switch.on::after{transform:translateX(20px)}
.bar{height:10px;border-radius:999px;background:var(--tile);border:1px solid var(--tile-line);overflow:hidden;margin-top:10px}
.bar i{display:block;height:100%;border-radius:999px;background:var(--c,var(--ok))}
.action{display:flex;align-items:center;justify-content:center;gap:10px;min-height:64px;border-radius:20px;font-size:17px;font-weight:700;width:100%;margin-top:16px;
  background:var(--tile);border:1px solid var(--tile-line)}
.action.primary{background:linear-gradient(160deg,color-mix(in srgb,var(--c,var(--home)) 80%,#fff),var(--c,var(--home)));color:#fff;border-color:transparent;
  box-shadow:0 10px 28px color-mix(in srgb,var(--c,var(--home)) 35%,transparent)}
.alerts .task{margin-top:8px}
.big-ring{display:grid;justify-items:center;gap:10px;padding:10px 0}
.big-ring .ring{width:190px;height:190px;border-width:4px}
.big-ring .ring .num{font-size:48px}

/* Rain, air chart, hours, door */
.estats{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.estat{display:flex;align-items:center;gap:12px;padding:12px;border-radius:18px;background:var(--tile);border:1px solid var(--tile-line);min-width:0}
.estat .badge{width:40px;height:40px;border-radius:14px;display:grid;place-items:center;flex:none;color:var(--c);background:color-mix(in srgb,var(--c) 16%,transparent)}
.estat .badge svg{width:22px;height:22px}
.estat .v{font-size:26px;line-height:1.1}.estat .v small{font-size:13px;color:var(--dim);margin-left:3px;font-family:inherit}
.estat>div{min-width:0}.estat .st{font-size:12.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bars{display:flex;gap:6px;align-items:flex-end;height:96px;margin-top:14px}
.bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%}
.bar .col{flex:1;width:100%;display:flex;align-items:flex-end;border-radius:6px;overflow:hidden;background:color-mix(in srgb,var(--c) 7%,transparent)}
.bar .fill{width:100%;border-radius:4px 4px 0 0;background:color-mix(in srgb,var(--c) 55%,transparent)}
.bar.today .fill{background:var(--c)}
.bar .d{font-size:11px;color:var(--dim)}.bar.today .d{color:var(--text);font-weight:700}
.erows{margin-top:12px}.erow{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--tile-line);font-size:14px}
.agenda .evday{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin:14px 0 2px}
.agenda .evday:first-child{margin-top:0}
.ev{display:flex;align-items:center;gap:14px;min-height:52px;padding:6px 12px;border-radius:16px;background:var(--tile);border:1px solid var(--tile-line);margin-top:6px}
.ev .when{flex:none;width:96px;font-size:14px}
.ev .txt{flex:1;min-width:0}.ev .name{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ev .st{font-size:13px;color:var(--dim)}
.ev.now{border-color:color-mix(in srgb,var(--accent) 55%,transparent);background:color-mix(in srgb,var(--accent) 12%,var(--tile))}
.ev.now .when{color:var(--accent)}
.pill.bins{color:var(--ev);background:color-mix(in srgb,var(--ev) 14%,var(--card));border-color:color-mix(in srgb,var(--ev) 35%,transparent)}
.bindots{display:inline-flex;gap:4px;flex:none}
.bindot{width:14px;height:14px;border-radius:50%;background:var(--c);box-shadow:inset 0 0 0 1px rgba(100,116,139,.45)}
.bindot.big{width:28px;height:28px;flex:none}
.binrow{width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer}
.binrow svg{width:20px;height:20px;color:var(--dim)}
.binday{margin-top:14px}.binday h3 .dim{font-weight:500}
.bin{display:flex;align-items:center;gap:12px;margin-top:10px}.bin .name{font-weight:700}.bin .st{font-size:13px;color:var(--dim)}
.pill.rain{color:var(--home);background:color-mix(in srgb,var(--home) 14%,var(--card));border-color:color-mix(in srgb,var(--home) 35%,transparent)}
.chart{display:block;width:100%;height:110px;margin-top:8px;overflow:visible}
.chart .line{fill:none;stroke:var(--home);stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.chart .fill{fill:color-mix(in srgb,var(--home) 16%,transparent);stroke:none}
.chart .warn,.chart .bad{stroke-width:1;stroke-dasharray:4 4;vector-effect:non-scaling-stroke}
.chart .warn{stroke:var(--solar);opacity:.6}.chart .bad{stroke:var(--act);opacity:.6}
.chart-wrap{position:relative;touch-action:pan-y;cursor:crosshair;-webkit-user-select:none;user-select:none}
.scrub{position:absolute;top:8px;bottom:0;width:0;border-left:1.5px solid var(--text);opacity:.85;pointer-events:none}
.scrub .dotm{position:absolute;left:-6px;width:11px;height:11px;margin-top:-5px;border-radius:50%;background:var(--home);box-shadow:0 0 0 3px var(--ground)}
.scrub .tip{position:absolute;bottom:calc(100% + 6px);left:0;transform:translateX(-50%);white-space:nowrap;font-size:13px;line-height:1.35;padding:6px 10px;border-radius:12px;background:color-mix(in srgb,var(--text) 6%,var(--ground));border:1px solid var(--card-line);box-shadow:0 6px 18px rgba(0,0,0,.18);text-align:center}
.scrub .tip.left{transform:translateX(-100%)}.scrub .tip.right{transform:none}
.scrub .tip b{font-size:16px}
.bars{touch-action:pan-y;cursor:pointer}
.bar.picked .fill{background:var(--c)}.bar.picked .d{color:var(--text);font-weight:700}
.bars-readout{font-size:13px;margin-top:8px;min-height:18px}
.chart-axis{display:flex;justify-content:space-between;font-size:12px;margin-top:6px}
.chart-empty{font-size:13px;padding:18px 0}
.hours{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(64px,1fr);gap:8px;overflow-x:auto;padding-bottom:4px}
.day.wet{background:color-mix(in srgb,var(--home) 14%,var(--tile));border-color:color-mix(in srgb,var(--home) 35%,transparent)}
.days.week{grid-template-columns:repeat(7,minmax(0,1fr))}
@media (max-width:720px){.days.week{grid-template-columns:repeat(4,minmax(0,1fr))}}
.stream{aspect-ratio:16/9}
.door-info .door-now .num{font-size:48px}
.door-info .action:first-of-type{margin-top:14px}

@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;

// ---- The element -----------------------------------------------------------
class RossHome extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this._sheet = null;          // {kind, ...}
    this._armed = null;          // a risky tile waiting for its second tap
    this._forecast = [];
    this._hourly = [];
    this._history = null;      // {at, points: [[ms, value]]}
    this._lastDoor = undefined; // the doorbell's last activity seen
    this._touched = 0;         // last tap, so a self-update never reloads mid-use
    this._todo = [];
    this._bins = null;
    this._events = null;
    this._energy = null;       // {at, elec: Map(dayMs → kWh), water: Map(dayMs → L)}       // {at, list: [{start, end, allDay, summary, location}]}         // {at, days: [{date, items}]}
    this._sig = '';
    this._house = null;
    this._themePref = (() => { try { return localStorage.getItem('ross-home-theme') || 'auto'; } catch { return 'auto'; } })();
  }
  static getStubConfig() { return {}; }
  setConfig(config) {
    this._config = {...DEFAULTS, ...(config || {})};
    this._sig = '';
    if (this._hass) this._render(true);
  }
  getCardSize() { return 12; }
  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._start();
    this._render();
    if (this._house) this._house.update(hass, this._themeNow());
  }
  connectedCallback() { if (this._hass) this._start(); }
  disconnectedCallback() {
    if (this._house) { this._house.dispose(); this._house = null; this.shadowRoot.querySelector('.house-host')?.remove(); }
    clearInterval(this._tick);
    this._tick = null;
    for (const k of ['_unsubForecast', '_unsubHourly']) if (this[k]) { this[k].then((u) => u && u()).catch(() => {}); this[k] = null; }
    clearInterval(this._updateTimer);
    this._updateTimer = null;
  }

  _start() {
    requestFonts();
    // A doorbell notification opens the dashboard with ?door=1: go straight
    // to the front door live view, then tidy the address bar.
    try {
      const url = new URL(location.href);
      if (url.searchParams.has('door')) {
        this._openDoor();
        url.searchParams.delete('door');
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      }
    } catch { /* not in a browser */ }
    if (!this.shadowRoot.querySelector('.root')) {
      this.shadowRoot.innerHTML = `<style>${STYLES}</style><div class="root" data-theme="dark"><div class="glow"></div><div class="main"></div><div class="sheets"></div></div>`;
      this.shadowRoot.addEventListener('click', (e) => this._onClick(e));
      for (const ev of ['pointerdown', 'pointermove']) this.shadowRoot.addEventListener(ev, (e) => this._scrub(e));
      this.shadowRoot.addEventListener('pointerleave', (e) => this._scrub(e), true);
      this.shadowRoot.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this._sheet) this._close(); });
    }
    if (!this._tick) this._tick = setInterval(() => this._render(), 15000);
    if (this._config?.start_view === 'house' && !this._house && !this._houseClosed) setTimeout(() => this._openHouse(), 0);
    if (!this._updateTimer) this._updateTimer = setInterval(() => this._checkForUpdate(), 10 * 60000);
    this._subscribeForecast();
    this._loadTodo();
  }

  _subscribeForecast() {
    const id = this._config?.weather;
    if (!this._hass?.connection || !id || this._unsubForecast) return;
    this._unsubForecast = this._hass.connection.subscribeMessage((msg) => { this._forecast = msg.forecast || []; this._sig = ''; this._render(); },
      {type: 'weather/subscribe_forecast', forecast_type: 'daily', entity_id: id}).catch(() => null);
    this._unsubHourly = this._hass.connection.subscribeMessage((msg) => { this._hourly = msg.forecast || []; this._sig = ''; this._render(); },
      {type: 'weather/subscribe_forecast', forecast_type: 'hourly', entity_id: id}).catch(() => null);
  }
  // A wall tablet never needs a manual refresh: every ten minutes the panel
  // asks for its own file, and if HACS has installed a newer release it
  // reloads, but only while no sheet is open and nobody has touched it for
  // two minutes.
  async _checkForUpdate() {
    if (VERSION === 'dev' || this._sheet || Date.now() - this._touched < 120000) return;
    try {
      const url = new URL(import.meta.url);
      url.search = '';
      const head = (await (await fetch(url, {cache: 'no-store'})).text()).slice(0, 200);
      const found = head.match(/Ross Home (v[\w.]+)/)?.[1];
      if (found && found !== VERSION) location.reload();
    } catch { /* offline: try again next time */ }
  }
  // The purifier's PM2.5 over the last 24 hours, for its sheet; fetched at
  // most every ten minutes.
  async _loadHistory() {
    const id = this._config.pm25;
    if (!id || (this._history && Date.now() - this._history.at < 600000) || this._historyLoading) return;
    this._historyLoading = true;
    try {
      const start = new Date(Date.now() - 24 * 3600e3).toISOString();
      const res = await this._hass.callWS({type: 'history/history_during_period', start_time: start, entity_ids: [id], minimal_response: true, no_attributes: true, significant_changes_only: false});
      const rows = res?.[id] || [];
      const points = rows.map((r) => [(r.lu ?? r.lc ?? 0) * 1000, Number(r.s)]).filter(([t, v]) => t && Number.isFinite(v));
      this._history = {at: Date.now(), points};
      this._sig = '';
      this._render();
    } catch { this._history = {at: Date.now(), points: []}; } finally { this._historyLoading = false; }
  }
  // The doorbell: a new press opens the front door sheet on every screen
  // showing the panel, and closes it again after three minutes.
  _openDoor() {
    this._sheet = {kind: 'door', ring: true};
    clearTimeout(this._doorTimer);
    this._doorTimer = setTimeout(() => { if (this._sheet?.kind === 'door') this._close(); }, 3 * 60000);
  }
  _watchDoor() {
    const press = this._s(this._config.doorbell_press)?.state;
    if (press !== undefined) {
      if (this._lastPress !== undefined && press === 'on' && this._lastPress !== 'on') this._openDoor();
      this._lastPress = press;
    }
    const act = this._s(this._config.doorbell_activity);
    if (!act) return;
    const key = act.state;
    if (this._lastDoor === undefined) { this._lastDoor = key; return; }
    if (key === this._lastDoor) return;
    this._lastDoor = key;
    const fresh = Date.now() - Date.parse(key) < 3 * 60000;
    if (act.attributes?.category === 'ding' && fresh && this._sheet?.kind !== 'door') this._openDoor();
  }
  // When rain is next expected in the coming twelve hours, or that it is
  // raining now.
  _rain() {
    const w = this._s(this._config.weather)?.state;
    if (/rain|pouring|lightning|hail/.test(w || '')) return {now: true, text: 'Raining now'};
    const soon = Date.now() + 12 * 3600e3;
    const hour = this._hourly.find((f) => {
      const t = Date.parse(f.datetime);
      return t > Date.now() - 30 * 60000 && t < soon && ((f.precipitation_probability ?? 0) >= 50 || (f.precipitation ?? 0) >= 0.3 || /rain|pouring|lightning|hail/.test(f.condition || ''));
    });
    return hour ? {now: false, text: `Rain at ${hhmm(new Date(hour.datetime))}`, at: hour.datetime} : null;
  }
  // Bin days from the council's calendar, fetched every half hour.
  async _loadBins() {
    const id = this._config?.bins;
    if (!id || !this._s(id) || (this._bins && Date.now() - this._bins.at < 1800000) || this._binsLoading) return;
    this._binsLoading = true;
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 29 * 86400e3);
      const res = await this._hass.callApi('GET', `calendars/${id}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
      const byDay = new Map();
      for (const e of res || []) {
        const d = e.start?.date || (e.start?.dateTime || '').slice(0, 10);
        if (!d) continue;
        if (!byDay.has(d)) byDay.set(d, []);
        byDay.get(d).push(binInfo(e.summary));
      }
      this._bins = {at: Date.now(), days: [...byDay].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, items]) => ({date, items}))};
      this._sig = '';
      this._render();
    } catch { this._bins = {at: Date.now(), days: []}; } finally { this._binsLoading = false; }
  }
  // Daily electricity and water from Home Assistant's long-term statistics,
  // fetched every half hour.
  async _loadEnergy() {
    const c = this._config, ids = [c.energy_usage, c.water].filter((id) => id && this._s(id));
    if (!ids.length || (this._energy && Date.now() - this._energy.at < 1800000) || this._energyLoading) return;
    this._energyLoading = true;
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 14);
      const res = await this._hass.callWS({type: 'recorder/statistics_during_period', start_time: start.toISOString(), statistic_ids: ids, period: 'day', types: ['change'], units: {}});
      const toMap = (rows) => {
        const m = new Map();
        for (const r of rows || []) {
          const d = new Date(typeof r.start === 'number' ? r.start : Date.parse(r.start)); d.setHours(0, 0, 0, 0);
          if (Number.isFinite(r.change)) m.set(d.getTime(), (m.get(d.getTime()) || 0) + r.change);
        }
        return m;
      };
      this._energy = {at: Date.now(), elec: toMap(res?.[c.energy_usage]), water: toMap(res?.[c.water])};
      this._sig = '';
      this._render();
    } catch { this._energy = {at: Date.now(), elec: new Map(), water: new Map()}; } finally { this._energyLoading = false; }
  }
  // The last n days ending today, oldest first; today's electricity comes
  // straight from the meter's own "today" sensor.
  _energyDays(kind, n) {
    const out = [], today = new Date(); today.setHours(0, 0, 0, 0);
    const map = this._energy?.[kind] || new Map();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      let v = map.has(d.getTime()) ? map.get(d.getTime()) : null;
      if (kind === 'elec' && i === 0) v = num(this._s(this._config.energy_usage)) ?? v;
      out.push({day: d, v, today: i === 0});
    }
    return out;
  }
  _lastWater() {
    const days = this._energyDays('water', 15).filter((d) => d.v > 0);
    return days[days.length - 1] || null;
  }
  _bars(days, tone, unit, digits = 1) {
    const vals = days.map((d) => d.v).filter((v) => v !== null);
    if (vals.length < 2) return `<div class="chart-empty dim">Daily history builds up from today, a bar a day.</div>`;
    const max = Math.max(...vals, 0.001);
    const tip = (d) => `${d.today ? 'Today' : d.day.toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short'})} · ${d.v === null ? 'no data' : `${d.v.toFixed(digits)} ${unit}`}`;
    const last = [...days].reverse().find((d) => d.v !== null);
    return `<div class="bars" style="--c:var(--${tone})">${days.map((d) => `<div class="bar ${d.today ? 'today' : ''}" data-tip="${esc(tip(d))}">
        <span class="col"><span class="fill" style="height:${d.v === null ? 0 : Math.max(3, (d.v / max) * 100)}%"></span></span><span class="d">${d.day.toLocaleDateString('en-GB', {weekday: 'narrow'})}</span></div>`).join('')}</div>
      <div class="bars-readout dim">${last ? esc(tip(last)) : ''}<span class="hint-tap"> · tap a bar</span></div>`;
  }
  // The shared calendar's next two weeks, fetched every ten minutes.
  async _loadEvents() {
    const id = this._config?.calendar;
    if (!id || !this._s(id) || (this._events && Date.now() - this._events.at < 600000) || this._eventsLoading) return;
    this._eventsLoading = true;
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 15 * 86400e3);
      const res = await this._hass.callApi('GET', `calendars/${id}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
      let hide = null;
      try { hide = this._config.calendar_hide ? new RegExp(this._config.calendar_hide, 'i') : null; } catch { hide = null; }
      const list = (res || []).filter((e) => !(hide && hide.test(e.summary || ''))).map((e) => {
        const allDay = !!e.start?.date;
        return {allDay, start: allDay ? localDay(e.start.date) : new Date(e.start.dateTime), end: allDay ? localDay(e.end.date) : new Date(e.end?.dateTime || e.start.dateTime), summary: (e.summary || 'Busy').trim(), location: e.location || ''};
      }).sort((a, b) => a.start - b.start || b.allDay - a.allDay);
      this._events = {at: Date.now(), list};
      this._sig = '';
      this._render();
    } catch { this._events = {at: Date.now(), list: []}; } finally { this._eventsLoading = false; }
  }
  // Events not yet over, each with the day it shows under.
  _upcoming() {
    const now = new Date(), today = new Date(); today.setHours(0, 0, 0, 0);
    const out = [];
    for (const e of this._events?.list || []) {
      if (e.end <= now) continue;
      const first = e.start < today ? today : e.start;
      const day = new Date(first); day.setHours(0, 0, 0, 0);
      out.push({...e, day, away: Math.round((day - today) / 86400e3)});
    }
    return out;
  }
  _eventRows(list) {
    let last = null;
    return list.map((e) => {
      const head = e.away !== last ? `<div class="evday">${e.away === 0 ? 'Today' : e.away === 1 ? 'Tomorrow' : esc(e.day.toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'short'}))}</div>` : '';
      last = e.away;
      const now = !e.allDay && e.start <= new Date();
      const when = e.allDay ? 'All day' : `${hhmm(e.start)}<span class="dim">–${hhmm(e.end)}</span>`;
      return `${head}<div class="ev ${now ? 'now' : ''}"><span class="when num">${when}</span><span class="txt"><div class="name">${esc(e.summary)}</div>${e.location ? `<div class="st">${esc(e.location.split('\n')[0])}</div>` : now ? '<div class="st">On now</div>' : ''}</span></div>`;
    }).join('');
  }
  // The next collection still to come: today's counts until noon.
  _nextBins() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const upcoming = (this._bins?.days || []).map((d) => ({...d, away: Math.round((localDay(d.date) - today) / 86400e3)}))
      .filter((d) => d.away > 0 || (d.away === 0 && new Date().getHours() < 12));
    return upcoming;
  }
  async _loadTodo() {
    const id = this._config?.todo, s = this._hass?.states[id];
    if (!s) return;
    const key = `${s.state}|${s.last_updated}`;
    if (key === this._todoKey) return;
    this._todoKey = key;
    try {
      const res = await this._hass.callWS({type: 'todo/item/list', entity_id: id});
      this._todo = res.items || [];
      this._sig = '';
      this._render();
    } catch { /* the list stays as it was */ }
  }

  // ---- State reading -------------------------------------------------------
  _s(id) { return id ? this._hass.states[id] : undefined; }
  _areaOf(entityId) {
    const h = this._hass, e = h.entities?.[entityId];
    if (!e) return null;
    return e.area_id || (e.device_id && h.devices?.[e.device_id]?.area_id) || null;
  }
  _themeNow() {
    if (this._themePref !== 'auto') return this._themePref;
    const sun = this._s(this._config.sun);
    return sun ? (sun.state === 'above_horizon' ? 'light' : 'dark') : (this._hass.themes?.darkMode ? 'dark' : 'light');
  }
  _alerts() {
    const c = this._config, h = this._hass, out = [];
    for (const cam of c.cameras) {
      const s = this._s(cam.camera);
      if (s && s.state === 'unavailable') out.push({level: 'red', icon: 'camera', title: `${cam.name} camera offline`, detail: 'Check its power and Wi-Fi', entity: cam.camera});
      const b = num(this._s(cam.battery));
      if (b !== null && b <= 20) out.push({level: 'amber', icon: 'alert', title: `${cam.name} battery ${b}%`, detail: 'Charge it soon', entity: cam.battery});
    }
    const filter = num(this._s(c.filter_life));
    if (filter !== null && filter <= 10) out.push({level: 'amber', icon: 'leaf', title: `Purifier filter ${filter}% left`, detail: 'Order a replacement', entity: c.filter_life});
    const fan = this._s(c.purifier);
    if (fan && !ok(fan)) out.push({level: 'amber', icon: 'wind', title: 'Purifier offline', detail: 'Check it is plugged in', entity: c.purifier});
    const backup = Date.parse(this._s(c.backup)?.state || '');
    if (Number.isFinite(backup) && Date.now() - backup > 3 * 86400000) out.push({level: 'amber', icon: 'backup', title: 'No backup for 3 days', detail: 'Check Settings → Backups', entity: c.backup});
    const updates = Object.values(h.states).filter((s) => s.entity_id.startsWith('update.') && s.state === 'on');
    if (updates.length) out.push({level: 'amber', icon: 'refresh', title: updates.length === 1 ? `${updates[0].attributes.title || updates[0].attributes.friendly_name} update` : `${updates.length} updates ready`, detail: 'Install from Settings', entity: updates[0].entity_id});
    for (const s of Object.values(h.states)) {
      if (s.attributes?.device_class === 'battery' && s.attributes?.unit_of_measurement === '%' && !/iphone|phone/i.test(s.entity_id)
          && !c.cameras.some((cam) => cam.battery === s.entity_id)) {
        const v = num(s);
        if (v !== null && v <= 15) out.push({level: 'amber', icon: 'alert', title: `${s.attributes.friendly_name || 'Battery'} ${v}%`, detail: 'Battery running low', entity: s.entity_id});
      }
    }
    return out;
  }

  // ---- Rendering ----------------------------------------------------------
  _signature(now) {
    // Re-render only when something drawn has changed (the clock and the
    // "minutes ago" lines move with the minute).
    const h = this._hass, ids = new Set();
    const c = this._config;
    for (const k of ['energy_usage', 'energy_cost', 'water', 'weather', 'sun', 'purifier', 'air_quality', 'pm25', 'filter_life', 'purifier_display', 'purifier_child_lock', 'doorbell',
      'doorbell_activity', 'doorbell_press', 'floodlight', 'motion_alerts', 'todo', 'backup', 'remote', 'phone_battery']) if (c[k]) ids.add(c[k]);
    for (const cam of c.cameras) { ids.add(cam.camera); ids.add(cam.activity); ids.add(cam.battery); }
    let sig = `${Math.floor(now / 60000)}|${this._themePref}|${this._sheet ? JSON.stringify(this._sheet) : ''}|${this._armed}|${h.user?.name}`;
    for (const id of ids) { const s = h.states[id]; sig += `|${s?.state}:${s?.last_updated}`; }
    for (const s of Object.values(h.states)) {
      const d = s.entity_id.split('.')[0];
      if (d === 'light' || d === 'person' || d === 'update' || d === 'media_player' || d === 'climate') sig += `|${s.entity_id}:${s.state}:${s.attributes?.brightness ?? ''}`;
    }
    return sig + `|${Object.keys(h.areas || {}).length}|${this._rain()?.text}|${this._history?.at}|${this._bins?.at}|${this._events?.at}|${this._energy?.at}`;
  }
  _render(force = false) {
    if (!this._hass || !this._config || !this.shadowRoot.querySelector('.root')) return;
    this._loadTodo();
    this._loadBins();
    this._loadEvents();
    this._loadEnergy();
    this._watchDoor();
    const now = Date.now(), sig = this._signature(now);
    if (!force && sig === this._sig) return;
    this._sig = sig;
    const root = this.shadowRoot.querySelector('.root'), theme = this._themeNow(), hour = new Date().getHours();
    root.dataset.theme = theme;
    root.classList.toggle('night', hour >= 22 || hour < 6);
    this._mood(root);
    const alerts = this._alerts();
    root.querySelector('.main').innerHTML = this._header(alerts) +
      `<div class="grid"><div class="col c1">${this._airCard()}${this._weatherCard()}${this._calendarCard()}</div>` +
      `<div class="col c2">${this._actionsCard()}${this._roomsCard()}${this._energyCard()}</div>` +
      `<div class="col c3">${this._doorCard()}${this._camerasCard()}${this._todoCard()}</div></div>`;
    this._renderSheet(alerts);
  }
  _mood(root) {
    // The house mood behind the cards: gold in sun, grey in rain, blue at
    // night, red while something needs acting on now.
    const w = this._s(this._config.weather)?.state, dark = root.dataset.theme === 'dark';
    const act = this._alerts().some((a) => a.level === 'red');
    const [a, b] = act ? ['rgba(255,93,122,.22)', 'rgba(255,93,122,.10)']
      : /rain|pouring|lightning|snow|hail/.test(w || '') ? ['rgba(148,163,184,.22)', 'rgba(148,163,184,.12)']
        : !dark && /sunny|partly/.test(w || '') ? ['rgba(251,191,36,.30)', 'rgba(56,189,248,.14)']
          : ['rgba(56,189,248,.16)', 'rgba(141,123,255,.12)'];
    root.style.setProperty('--mood', a);
    root.style.setProperty('--mood2', b);
  }

  _header(alerts) {
    const h = this._hass, now = new Date(), hour = now.getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = (h.user?.name || '').split(' ')[0];
    const date = now.toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long'});
    const people = Object.values(h.states).filter((s) => s.entity_id.startsWith('person.'));
    const colours = ['#8d7bff', '#f472b6', '#fb923c', '#2dd4bf', '#38bdf8'];
    const avatars = people.map((p, i) => {
      const n = p.attributes.friendly_name || p.entity_id.slice(7), home = p.state === 'home';
      return `<span class="avatar ${home ? '' : 'away'}" style="${home ? `background:${colours[i % colours.length]}` : ''}" title="${esc(n)} · ${esc(pretty(p.state))}">${esc(n[0]?.toUpperCase())}</span>`;
    }).join('');
    const w = this._s(this._config.weather), night = this._s(this._config.sun)?.state === 'below_horizon';
    const temp = num({state: w?.attributes?.temperature});
    const red = alerts.filter((a) => a.level === 'red').length, amber = alerts.length - red;
    const status = !alerts.length ? '<span class="dot"></span>All systems normal'
      : red ? `<span class="dot red"></span>${alerts.find((a) => a.level === 'red').title}${alerts.length > 1 ? ` +${alerts.length - 1}` : ''}`
        : `<span class="dot amber"></span>${amber === 1 ? alerts[0].title : `${amber} things need you`}`;
    const themeIcon = this._themePref === 'auto' ? (this._themeNow() === 'dark' ? 'moon' : 'sun') : this._themePref === 'dark' ? 'moon' : 'sun';
    return `<header>
      <div class="hello"><h1>${greet}${name ? `, ${esc(name)}` : ''}</h1><p>${date}</p></div>
      ${people.length ? `<span class="pill wide people">${avatars}</span>` : ''}
      ${w ? `<span class="pill">${weatherIcon(w.state, night)}<span class="num">${temp === null ? '—' : Math.round(temp)}°</span><span class="dim">${esc(WEATHER_WORDS[w.state] || pretty(w.state))}</span></span>` : ''}
      ${this._binPill()}
      ${this._rainPill()}
      <button class="pill wide" data-act="sheet" data-kind="status">${status}</button>
      <button class="pill iconbtn" data-act="house" title="House view" aria-label="House view">${icon('home')}</button>
      <button class="pill iconbtn" data-act="theme" title="Theme: ${this._themePref}">${icon(themeIcon)}</button>
      <span class="clock num">${hhmm(now)}</span>
    </header>`;
  }

  _binPill() {
    const next = this._nextBins()[0];
    if (!next || next.away > 1) return '';
    return `<button class="pill bins" data-act="sheet" data-kind="bins">${binDots(next.items)}Bins ${next.away === 0 ? 'today' : 'tomorrow'}</button>`;
  }
  _rainPill() {
    const r = this._rain();
    return r ? `<button class="pill rain" data-act="sheet" data-kind="weather">${icon('umbrella')}${r.text}</button>` : '';
  }
  _card(label, note, body, go, noteCls = '') {
    return `<section class="card"><div class="card-h"><span class="label">${label}</span><span class="note ${noteCls}">${note || ''}</span>${go ? `<button class="go" ${go} aria-label="Open">${icon('chevron')}</button>` : ''}</div>${body}</section>`;
  }

  _airInfo() {
    const c = this._config, fan = this._s(c.purifier), aq = this._s(c.air_quality);
    const pm = num(this._s(c.pm25)), filter = num(this._s(c.filter_life));
    const quality = ok(aq) ? pretty(aq.state) : null;
    const tone = pm === null ? 'grid' : pm <= 12 ? 'ok' : pm <= 35 ? 'solar' : 'act';
    const on = fan?.state === 'on', preset = fan?.attributes?.preset_mode, pct = fan?.attributes?.percentage;
    const mode = !ok(fan) ? 'Offline' : !on ? 'Off' : preset ? pretty(preset) : 'Manual';
    const speed = on && !preset && pct ? `${Math.max(1, Math.round(pct / 33.34))} of 3` : on ? 'Auto' : '—';
    return {fan, on, preset, pct, quality, pm, filter, tone, mode, speed};
  }
  _airCard() {
    const a = this._airInfo(), c = this._config;
    const display = this._s(c.purifier_display);
    const body = `<div class="flow ${a.on ? 'live' : ''}" style="--wire:var(--${a.tone === 'grid' ? 'grid' : a.tone})"><div class="wire"></div>
        <div class="node"><div class="ring small" style="--c:var(--${a.filter !== null && a.filter <= 10 ? 'solar' : 'ok'})"><span class="num">${a.filter ?? '—'}<span class="unit">%</span></span></div>
          <span class="label">Filter</span><span class="state">${a.filter === null ? 'No reading' : a.filter > 10 ? 'Healthy' : 'Replace soon'}</span></div>
        <div class="node"><div class="ring big ${a.on ? 'halo' : ''}" style="--c:var(--${a.tone})"><span class="num">${a.pm ?? '—'}<span class="unit">µg</span><span class="sub">PM2.5</span></span></div>
          <span class="label">Bedroom</span><span class="state t-${a.tone}">${a.quality ? `Air ${a.quality.toLowerCase()}` : 'No reading'}</span></div>
        <div class="node"><div class="ring small" style="--c:var(--${a.on ? 'home' : 'grid'})">${icon(a.preset === 'sleep' ? 'sleep' : 'wind')}</div>
          <span class="label">Purifier</span><span class="state ${a.on ? 't-home' : ''}">${a.mode}</span></div>
      </div>
      <div class="stats">
        <div class="stat"><div class="label">Mode</div><div class="v">${a.mode}</div></div>
        <div class="stat"><div class="label">Speed</div><div class="v">${a.speed}</div></div>
        <div class="stat"><div class="label">Display</div><div class="v">${display ? pretty(display.state) : '—'}</div></div>
      </div>`;
    return this._card('Bedroom air', a.on ? `${a.mode} · running` : a.mode, body, 'data-act="sheet" data-kind="purifier"');
  }

  _energyCard() {
    const c = this._config, use = this._s(c.energy_usage), water = this._s(c.water);
    if (!use && !water) return '';
    const kwh = num(use), cost = num(this._s(c.energy_cost)), w = this._lastWater();
    const days = this._energyDays('elec', 7), yesterday = days[days.length - 2]?.v;
    const body = `<div class="estats">
        ${use ? `<div class="estat" style="--c:var(--solar)"><span class="badge">${icon('bolt')}</span><div><div class="v num">${kwh === null ? '—' : kwh.toFixed(1)}<small>kWh</small></div>
          <div class="st">Electricity today${cost !== null ? ` · £${cost.toFixed(2)}` : ''}</div></div></div>` : ''}
        ${water ? `<div class="estat" style="--c:var(--home)"><span class="badge">${icon('drop')}</span><div><div class="v num">${w ? Math.round(w.v) : '—'}<small>L</small></div>
          <div class="st">${w ? `Water · ${esc(w.day.toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric'}))}` : 'Water · Thames runs 3 days behind'}</div></div></div>` : ''}
      </div>${use ? this._bars(days, 'solar', 'kWh') : ''}`;
    return this._card('Energy', yesterday != null ? `Yesterday ${yesterday.toFixed(1)} kWh` : 'Last 7 days', body, 'data-act="sheet" data-kind="energy"');
  }
  _energySheet() {
    const c = this._config, kwh = num(this._s(c.energy_usage)), cost = num(this._s(c.energy_cost));
    const rate = num(this._s(c.energy_rate)), standing = num(this._s(c.energy_standing)), wrate = num(this._s(c.water_rate)), w = this._lastWater();
    const elec = this._energyDays('elec', 14), water = this._energyDays('water', 14);
    const total = (list) => list.reduce((a, d) => a + (d.v || 0), 0);
    const wk = elec.slice(-7), wkKwh = total(wk);
    const row = (k, v) => `<div class="erow"><span class="dim">${k}</span><b class="num">${v}</b></div>`;
    return this._sheetHead('bolt', 'solar', 'Energy', '', `<b>${kwh === null ? '—' : kwh.toFixed(1)} kWh today${cost !== null ? ` · £${cost.toFixed(2)}` : ''}</b><span class="dim">· meter data lands about 30 minutes late</span>`) +
      `<div class="panel"><h3>Electricity, last 14 days</h3>${this._bars(elec, 'solar', 'kWh')}
        <div class="erows">${row('This week', `${wkKwh.toFixed(1)} kWh${rate !== null ? ` · ≈ £${(wkKwh * rate + (standing || 0) * 7).toFixed(2)}` : ''}`)}
        ${rate !== null ? row('Unit rate', `${(rate * 100).toFixed(2)}p per kWh`) : ''}${standing !== null ? row('Standing charge', `${(standing * 100).toFixed(2)}p a day`) : ''}</div></div>
       <div class="panel" style="margin-top:14px"><h3>Water, last 14 days</h3><div class="hint">Thames Water's figures arrive about three days late.</div>${this._bars(water, 'home', 'L', 0)}
        <div class="erows">${row('Latest day', w ? `${Math.round(w.v)} L · ${esc(w.day.toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'short'}))}` : 'Waiting for Thames')}
        ${wrate !== null ? row('Water rate', `£${wrate.toFixed(2)} per m³`) : ''}</div></div>
       <button class="toggle-row" data-act="nav" data-kind="/energy" style="margin-top:14px"><span class="badge">${icon('bolt')}</span><span class="txt"><div class="name">Open the Energy dashboard</div><div class="st">Home Assistant's full charts and costs</div></span>${icon('chevron')}</button>`;
  }
  _calendarCard() {
    const s = this._s(this._config.calendar);
    if (!s) return '';
    const all = this._upcoming(), soon = all.filter((e) => e.away <= 6).slice(0, 3);
    const body = !this._events ? '<div class="empty dim">Loading…</div>'
      : soon.length ? `<div class="agenda">${this._eventRows(soon)}</div>`
        : `<div class="empty">${icon('calendar')}<span>Nothing planned this week.</span></div>`;
    const today = all.filter((e) => e.away === 0).length;
    return this._card(esc(s.attributes.friendly_name || 'Calendar'), today ? `${today} today` : 'Nothing today', body, 'data-act="sheet" data-kind="agenda"');
  }
  _weatherCard() {
    const w = this._s(this._config.weather);
    if (!w) return '';
    const at = w.attributes, night = this._s(this._config.sun)?.state === 'below_horizon';
    const temp = num({state: at.temperature}), today = this._forecast[0];
    const setting = this._s(this._config.sun)?.attributes?.next_setting, rising = this._s(this._config.sun)?.attributes?.next_rising;
    const sunChip = night && rising ? `Sunrise ${hhmm(new Date(rising))}` : setting ? `Sunset ${hhmm(new Date(setting))}` : '';
    const wind = at.wind_speed != null ? ` · wind ${Math.round(at.wind_speed)} ${esc(at.wind_speed_unit || '')}` : '';
    const days = this._forecast.slice(0, 5).map((f, i) => {
      const d = new Date(f.datetime);
      const rain = f.precipitation ? `<span class="rain">${(+f.precipitation).toFixed(1)} mm</span>` : '';
      return `<div class="day"><span class="d">${i === 0 ? 'Today' : d.toLocaleDateString('en-GB', {weekday: 'short'})}</span>${weatherIcon(f.condition)}
        <span class="hi">${Math.round(f.temperature)}°</span><span class="lo">${f.templow != null ? `${Math.round(f.templow)}°` : ''}</span>${rain}</div>`;
    }).join('');
    const body = `<div class="wx-now">${weatherIcon(w.state, night)}<div><div class="num">${temp === null ? '—' : Math.round(temp)}<sup>°</sup></div>
        <div class="cond">${esc(WEATHER_WORDS[w.state] || pretty(w.state))}</div>
        ${today ? `<div class="hl">High ${Math.round(today.temperature)}°${today.templow != null ? ` · Low ${Math.round(today.templow)}°` : ''}</div>` : ''}</div>
        ${sunChip ? `<span class="chip">${sunChip}</span>` : ''}</div>
      ${days ? `<div class="days">${days}</div>` : ''}`;
    return this._card('Weather', `${at.humidity != null ? `${Math.round(at.humidity)}% humidity` : ''}${wind}`, body, 'data-act="sheet" data-kind="weather"');
  }

  _tile({key, ic, name, st, on, tone = 'home', act, entity, kind, armed}) {
    return `<button class="tile ${on ? 'on' : ''} ${armed ? 'armed' : ''}" style="--c:var(--${tone})" data-act="${act}" data-key="${key}" ${entity ? `data-entity="${entity}"` : ''} ${kind ? `data-kind="${kind}"` : ''}>
      <span class="badge">${icon(ic)}</span><span><div class="name">${name}</div><div class="st">${st}</div></span></button>`;
  }
  _actionsCard() {
    const c = this._config, h = this._hass, a = this._airInfo(), tiles = [];
    if (a.fan) {
      tiles.push(this._tile({key: 'purifier', ic: 'wind', name: 'Purifier', st: a.on ? `${a.mode} · on` : a.mode, on: a.on, tone: 'home', act: 'sheet', kind: 'purifier'}));
      tiles.push(this._tile({key: 'sleep', ic: 'sleep', name: 'Sleep mode', st: a.preset === 'sleep' ? 'Quiet, dim' : 'Tap to run', on: a.preset === 'sleep', tone: 'accent', act: 'sleep'}));
    }
    const flood = this._s(c.floodlight);
    if (flood) tiles.push(this._tile({key: 'flood', ic: 'flood', name: 'Floodlight', st: !ok(flood) ? 'Offline' : flood.state === 'on' ? 'On' : 'Off', on: flood.state === 'on', tone: 'solar', act: 'toggle', entity: flood.entity_id}));
    const motion = this._s(c.motion_alerts);
    if (motion) tiles.push(this._tile({key: 'motion', ic: 'motion', name: 'Motion alerts', st: motion.state === 'on' ? 'Garden · on' : 'Garden · off', on: motion.state === 'on', tone: 'ev', act: 'toggle', entity: motion.entity_id}));
    const lights = Object.values(h.states).filter((s) => s.entity_id.startsWith('light.') && !c.exclude_lights.includes(s.entity_id));
    const lit = lights.filter((s) => s.state === 'on').length;
    tiles.push(this._tile({key: 'lights', ic: 'bulb', name: 'Lights', st: !lights.length ? 'None yet' : lit ? `${lit} on` : 'All off', on: lit > 0, tone: 'solar', act: lit ? 'lights-off' : 'none', armed: this._armed === 'lights'}));
    const cams = c.cameras.filter((cam) => this._s(cam.camera)), online = cams.filter((cam) => ok(this._s(cam.camera))).length;
    if (cams.length) tiles.push(this._tile({key: 'cameras', ic: 'camera', name: 'Cameras', st: `${online} of ${cams.length} online`, on: false, act: 'sheet', kind: 'cameras'}));
    const backup = this._s(c.backup);
    if (backup) tiles.push(this._tile({key: 'backup', ic: 'backup', name: 'Back up', st: this._armed === 'backup' ? 'Tap again to start' : `Last ${ago(backup.state) || '—'}`, on: false, tone: 'ok', act: 'backup', armed: this._armed === 'backup'}));
    const updates = Object.values(h.states).filter((s) => s.entity_id.startsWith('update.') && s.state === 'on').length;
    tiles.push(this._tile({key: 'updates', ic: 'refresh', name: 'Updates', st: updates ? `${updates} ready` : 'Up to date', on: updates > 0, tone: 'solar', act: 'nav', kind: '/config/updates'}));
    if (this._armed === 'lights') tiles[tiles.findIndex((t) => t.includes('data-key="lights"'))] = this._tile({key: 'lights', ic: 'bulb', name: 'Lights', st: 'Tap again: all off', on: true, tone: 'solar', act: 'lights-off', armed: true});
    return this._card('Quick actions', 'tap a tile', `<div class="tiles">${tiles.slice(0, 8).join('')}</div>`);
  }

  _roomsCard() {
    const h = this._hass, c = this._config, areas = Object.values(h.areas || {});
    const rooms = areas.map((area) => {
      const ents = Object.keys(h.states).filter((id) => this._areaOf(id) === area.area_id);
      const lights = ents.filter((id) => id.startsWith('light.') && !c.exclude_lights.includes(id)).map((id) => h.states[id]);
      const lit = lights.filter((s) => s.state === 'on');
      const temp = ents.map((id) => h.states[id]).find((s) => s.attributes?.device_class === 'temperature' && num(s) !== null);
      const fans = ents.filter((id) => id.startsWith('fan.') && h.states[id].state === 'on').length;
      const cams = ents.filter((id) => id.startsWith('camera.')).length;
      const media = ents.map((id) => h.states[id]).find((s) => s.entity_id.startsWith('media_player.') && ['playing', 'on'].includes(s.state));
      const parts = [];
      if (temp) parts.push(`${Math.round(num(temp))}°`);
      if (lit.length) parts.push(`${lit.length} light${lit.length > 1 ? 's' : ''}`);
      else if (lights.length) parts.push('Off');
      if (media) parts.push(media.state === 'playing' ? 'Playing' : 'TV on');
      if (fans) parts.push('Purifier on');
      if (!parts.length && cams) parts.push(`${cams} camera${cams > 1 ? 's' : ''}`);
      return {area, lights, lit, line: parts.join(' · '), relevant: lights.length || fans || cams || media || temp};
    }).filter((r) => r.relevant);
    const litRooms = rooms.filter((r) => r.lit.length).length;
    const body = rooms.length ? `<div class="rooms">${rooms.map((r) => `
        <div class="room ${r.lit.length ? 'lit' : ''}">
          <span class="badge">${icon(roomIcon(r.area.name))}</span>
          <span class="txt"><div class="name">${esc(r.area.name)}</div><div class="st">${esc(r.line || 'Nothing on')}</div></span>
          ${r.lights.length ? `<button class="bulb" data-act="room" data-area="${esc(r.area.area_id)}" aria-label="Lights in ${esc(r.area.name)}">${icon('bulb')}</button>` : ''}
        </div>`).join('')}</div>`
      : '';
    const empty = !Object.values(h.states).some((s) => s.entity_id.startsWith('light.') && !c.exclude_lights.includes(s.entity_id))
      ? `<div class="empty" style="${rooms.length ? 'margin-top:10px' : ''}">${icon('bulb')}<span>Your porch and office bulbs will appear here, glowing while they're on, as soon as they're paired.</span></div>` : '';
    return this._card('Rooms', rooms.length ? `${litRooms ? `${litRooms} room${litRooms > 1 ? 's' : ''} lit` : 'All lights off'}` : '', body + empty);
  }

  _snapUrl(cam) {
    const pic = cam?.attributes?.entity_picture;
    if (!pic) return '';
    if (pic.startsWith('data:')) return pic;
    return `${pic}${pic.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}`;
  }
  _doorCard() {
    const c = this._config, cam = this._s(c.doorbell), act = this._s(c.doorbell_activity);
    if (!cam && !act) return '';
    const kind = act?.attributes?.category === 'ding' ? 'Doorbell rang' : act?.attributes?.category === 'motion' ? 'Motion' : act?.attributes?.category === 'on_demand' ? 'Live view' : 'Activity';
    const recent = Date.now() - Date.parse(act?.state || '') < 15 * 60000;
    const flood = this._s(c.floodlight), motion = this._s(c.motion_alerts);
    const body = `<div class="door-now"><div><div class="num">${whenShort(act?.state)}</div><div class="sub">${kind} · ${ago(act?.state) || 'no recent activity'}</div></div></div>
      ${cam ? `<button class="snap door-snap ${ok(cam) ? '' : 'off'}" data-act="sheet" data-kind="door" aria-label="Open the front door">
        <img src="${esc(this._snapUrl(cam))}" alt="" loading="lazy"><span class="cap"><span class="dot ${ok(cam) ? '' : 'red'}"></span>${ok(cam) ? 'Tap for live view' : 'Offline'}</span></button>` : ''}
      <div class="row">${flood ? `<button class="chip ${flood.state === 'on' ? 'amber' : ''}" data-act="toggle" data-entity="${flood.entity_id}">${icon('flood')}Floodlight ${flood.state === 'on' ? 'on' : 'off'}</button>` : ''}
        ${motion ? `<button class="chip ${motion.state === 'on' ? 'ok' : ''}" data-act="toggle" data-entity="${motion.entity_id}">${icon('motion')}Motion alerts ${motion.state === 'on' ? 'on' : 'off'}</button>` : ''}</div>`;
    return this._card('Front door', recent ? `<span class="t-solar">${kind} just now</span>` : 'Ring doorbell', body, cam ? 'data-act="sheet" data-kind="door"' : '');
  }
  _camerasCard() {
    const cams = this._config.cameras.filter((cam) => this._s(cam.camera) && cam.camera !== this._config.doorbell);
    if (!cams.length) return '';
    const body = `<div class="cams">${cams.map((cam) => this._camTile(cam)).join('')}</div>`;
    return this._card('Cameras', `${cams.length} more`, body, 'data-act="sheet" data-kind="cameras"');
  }
  _camTile(cam) {
    const s = this._s(cam.camera), when = ago(this._s(cam.activity)?.state);
    return `<button class="snap ${ok(s) ? '' : 'off'}" data-act="more" data-entity="${cam.camera}" aria-label="Open ${esc(cam.name)} live view">
      <img src="${esc(this._snapUrl(s))}" alt="" loading="lazy"><span class="cap"><span class="dot ${ok(s) ? '' : 'red'}"></span>${esc(cam.name)}${when ? ` · ${when}` : ''}</span></button>`;
  }
  _todoCard() {
    const s = this._s(this._config.todo);
    if (!s) return '';
    const open = this._todo.filter((i) => i.status === 'needs_action');
    const next = this._nextBins()[0];
    const bins = next ? `<button class="task binrow" data-act="sheet" data-kind="bins">${binDots(next.items)}<span class="txt"><div class="name">Bins ${binWhen(next)}</div>
        <div class="st">${esc(next.items.map((b) => b.short).join(', '))}</div></span>${icon('chevron')}</button>` : '';
    const body = bins + (open.length ? open.slice(0, 4).map((i) => `<div class="task"><span class="txt"><div class="name">${esc(i.summary)}</div>${i.due ? `<div class="st">Due ${esc(i.due)}</div>` : ''}</span>
        <button class="tick" data-act="tick" data-uid="${esc(i.uid)}" aria-label="Tick off ${esc(i.summary)}">${icon('check')}</button></div>`).join('')
      : `<div class="empty">${icon('list')}<span>Nothing on the list. Add things from the Home Assistant app or say “Alexa, add milk to my shopping list.”</span></div>`);
    return this._card(esc(s.attributes.friendly_name || 'To do'), open.length > 4 ? `${open.length - 4} more` : open.length ? `${open.length} to get` : '', body, `data-act="more" data-entity="${s.entity_id}"`);
  }

  // ---- Sheets -------------------------------------------------------------
  _renderSheet(alerts) {
    const host = this.shadowRoot.querySelector('.sheets');
    if (!this._sheet) { host.innerHTML = ''; return; }
    const kind = this._sheet.kind, existing = host.querySelector('.sheet');
    if (kind === 'purifier') this._loadHistory();
    if (kind === 'door') {
      // The live stream must survive state updates, so only the words change.
      if (existing && existing.dataset.kind === 'door') { existing.querySelector('.door-info').innerHTML = this._doorInfo(); return; }
      host.innerHTML = `<div class="layer" data-act="close"><div class="sheet" role="dialog" aria-modal="true" data-kind="door">${this._doorSheet()}</div></div>`;
      this._mountStream(host.querySelector('.stream'));
      return;
    }
    const html = kind === 'purifier' ? this._purifierSheet() : kind === 'cameras' ? this._camerasSheet() : kind === 'weather' ? this._weatherSheet() : kind === 'bins' ? this._binsSheet() : kind === 'agenda' ? this._agendaSheet() : kind === 'energy' ? this._energySheet() : this._statusSheet(alerts);
    if (existing && existing.dataset.kind === kind) { existing.innerHTML = html; return; }
    host.innerHTML = `<div class="layer" data-act="close"><div class="sheet" role="dialog" aria-modal="true" data-kind="${kind}">${html}</div></div>`;
  }
  _sheetHead(ic, tone, title, dot, line) {
    return `<div class="sheet-h"><span class="big" style="--c:var(--${tone})">${icon(ic)}</span><div><h2>${title}</h2>
      <div class="line"><span class="dot ${dot}"></span>${line}</div></div><button class="x" data-act="close" aria-label="Close">${icon('x')}</button></div>`;
  }
  _purifierSheet() {
    const a = this._airInfo(), c = this._config, display = this._s(c.purifier_display), lock = this._s(c.purifier_child_lock);
    const speedSel = a.on && !a.preset && a.pct ? Math.max(1, Math.round(a.pct / 33.34)) : 0;
    const modes = [['auto', 'Auto', 'gauge'], ['sleep', 'Sleep', 'sleep'], ['manual', 'Manual', 'wind']];
    const current = !a.on ? '' : a.preset || 'manual';
    const toggle = (s, ic, name, sub) => s ? `<button class="toggle-row" data-act="toggle" data-entity="${s.entity_id}"><span class="badge">${icon(ic)}</span>
        <span class="txt"><div class="name">${name}</div><div class="st">${sub}</div></span><span class="switch ${s.state === 'on' ? 'on' : ''}" style="--c:var(--home)"></span></button>` : '';
    return this._sheetHead('wind', 'home', esc(c.purifier_name), a.on ? 'blue' : 'off', `<b>${a.on ? 'Running' : a.mode}</b><span class="dim">· ${a.quality ? `Air ${a.quality.toLowerCase()}` : 'No air reading'}</span>`) +
      `<div class="sheet-body"><div class="panel"><div class="big-ring"><div class="ring ${a.on ? 'halo' : ''}" style="--c:var(--${a.tone})">
          <span class="num">${a.pm ?? '—'}<span class="unit">µg/m³</span><span class="sub">PM2.5 now</span></span></div>
          <div class="t-${a.tone}" style="font-weight:700">${a.quality ? `Air ${a.quality.toLowerCase()}` : 'No reading'}</div></div>
          <div class="field"><span class="label">Filter life</span><div style="display:flex;justify-content:space-between"><span class="num" style="font-size:24px">${a.filter ?? '—'}<span class="unit">%</span></span>
          <span class="dim" style="font-size:13px;align-self:end">${a.filter !== null && a.filter <= 10 ? 'Order a replacement' : 'Healthy'}</span></div>
          <div class="bar" style="--c:var(--${a.filter !== null && a.filter <= 10 ? 'solar' : 'ok'})"><i style="width:${Math.max(0, Math.min(100, a.filter ?? 0))}%"></i></div></div>
          <div class="field"><span class="label">PM2.5 · last 24 hours</span>${this._airChart()}</div></div>
        <div class="panel"><h3>How it runs</h3><div class="hint">Auto follows the air; Sleep is quiet with the display off.</div>
          <span class="label">Mode</span><div class="seg" style="--c:var(--home);margin-top:8px">${modes.map(([v, l, ic]) => `<button class="${current === v ? 'sel' : ''}" data-act="mode" data-mode="${v}">${icon(ic)}${l}</button>`).join('')}</div>
          <div class="field"><span class="label">Fan speed</span><div class="seg" style="--c:var(--home)">${[1, 2, 3].map((n) => `<button class="${speedSel === n ? 'sel' : ''}" data-act="speed" data-speed="${n}"><span class="num" style="font-size:18px">${n}</span></button>`).join('')}</div></div>
          ${toggle(display, 'screen', 'Display', display?.state === 'on' ? 'Lit' : 'Dark')}${toggle(lock, 'lock', 'Child lock', lock?.state === 'on' ? 'Buttons locked' : 'Buttons work')}
          <button class="action ${a.on ? '' : 'primary'}" style="--c:var(--home)" data-act="power">${icon('power')}${a.on ? 'Turn off' : 'Turn on'}</button></div></div>`;
  }
  _doorInfo() {
    const c = this._config, act = this._s(c.doorbell_activity), flood = this._s(c.floodlight);
    const kind = act?.attributes?.category === 'ding' ? 'Doorbell rang' : act?.attributes?.category === 'motion' ? 'Motion' : 'Activity';
    return `<div class="door-now"><div><div class="num">${whenShort(act?.state)}</div><div class="sub">${kind} · ${ago(act?.state) || 'no recent activity'}</div></div></div>
      <button class="action primary" style="--c:var(--home)" data-act="more" data-entity="${c.doorbell}">${icon('camera')}Open live view with sound</button>
      ${flood ? `<button class="toggle-row" data-act="toggle" data-entity="${flood.entity_id}"><span class="badge">${icon('flood')}</span><span class="txt"><div class="name">Garden floodlight</div><div class="st">${flood.state === 'on' ? 'On' : 'Off'}</div></span><span class="switch ${flood.state === 'on' ? 'on' : ''}" style="--c:var(--solar)"></span></button>` : ''}
      <button class="action" data-act="close">Dismiss</button>`;
  }
  _doorSheet() {
    const c = this._config, cam = this._s(c.doorbell), ring = this._sheet?.ring;
    return this._sheetHead(ring ? 'bell' : 'door', ring ? 'solar' : 'home', ring ? 'Someone’s at the door' : 'Front door', ring ? 'amber' : (ok(cam) ? '' : 'red'),
      `<b>${ring ? 'Doorbell rang' : ok(cam) ? 'Camera online' : 'Camera offline'}</b><span class="dim">· Ring</span>`) +
      `<div class="sheet-body"><div class="panel" style="padding:10px"><div class="stream snap"><img src="${esc(this._snapUrl(cam))}" alt=""></div></div>
        <div class="panel door-info">${this._doorInfo()}</div></div>`;
  }
  // Home Assistant's own camera player when the page has loaded it; else a
  // snapshot that refreshes every five seconds, with live view a tap away.
  _mountStream(slot) {
    const cam = this._s(this._config.doorbell);
    if (!slot || !cam) return;
    if (customElements.get('ha-camera-stream')) {
      const player = document.createElement('ha-camera-stream');
      player.hass = this._hass; player.stateObj = cam; player.muted = true; player.controls = true;
      player.style.cssText = 'display:block;width:100%;height:100%';
      slot.replaceChildren(player);
      return;
    }
    const img = slot.querySelector('img');
    clearInterval(this._streamTimer);
    this._streamTimer = setInterval(() => {
      if (!img.isConnected) { clearInterval(this._streamTimer); return; }
      const pic = this._s(this._config.doorbell)?.attributes?.entity_picture;
      if (pic && !pic.startsWith('data:')) img.src = `${pic}${pic.includes('?') ? '&' : '?'}t=${Date.now()}`;
    }, 5000);
  }
  _weatherSheet() {
    const w = this._s(this._config.weather), night = this._s(this._config.sun)?.state === 'below_horizon', r = this._rain();
    const temp = num({state: w?.attributes?.temperature});
    const hours = this._hourly.filter((f) => Date.parse(f.datetime) > Date.now() - 30 * 60000).slice(0, 12).map((f) => {
      const wet = (f.precipitation_probability ?? 0) >= 50 || (f.precipitation ?? 0) >= 0.3;
      return `<div class="day ${wet ? 'wet' : ''}"><span class="d">${hhmm(new Date(f.datetime))}</span>${weatherIcon(f.condition, new Date(f.datetime).getHours() < 6 || new Date(f.datetime).getHours() >= 20)}
        <span class="hi">${Math.round(f.temperature)}°</span><span class="rain">${f.precipitation_probability != null ? `${Math.round(f.precipitation_probability)}%` : f.precipitation ? `${(+f.precipitation).toFixed(1)} mm` : ''}</span></div>`;
    }).join('');
    const days = this._forecast.slice(0, 7).map((f, i) => `<div class="day"><span class="d">${i === 0 ? 'Today' : new Date(f.datetime).toLocaleDateString('en-GB', {weekday: 'short'})}</span>${weatherIcon(f.condition)}
        <span class="hi">${Math.round(f.temperature)}°</span><span class="lo">${f.templow != null ? `${Math.round(f.templow)}°` : ''}</span>${f.precipitation ? `<span class="rain">${(+f.precipitation).toFixed(1)} mm</span>` : ''}</div>`).join('');
    return this._sheetHead('cloud', 'home', 'Weather', r ? 'blue' : '', `<b>${temp === null ? '—' : Math.round(temp)}° · ${esc(WEATHER_WORDS[w?.state] || pretty(w?.state))}</b><span class="dim">· ${r ? r.text : 'No rain in the next 12 hours'}</span>`) +
      `<div class="panel"><h3>Next 12 hours</h3><div class="hint">Chance of rain under each hour; wet hours are tinted.</div><div class="hours">${hours || '<div class="dim">Hourly forecast loading…</div>'}</div></div>
       <div class="panel" style="margin-top:14px"><h3>This week</h3><div class="days week">${days}</div></div>`;
  }
  _agendaSheet() {
    const s = this._s(this._config.calendar), all = this._upcoming(), today = all.filter((e) => e.away === 0).length;
    return this._sheetHead('calendar', 'accent', esc(s?.attributes.friendly_name || 'Calendar'), '', `<b>${today ? `${today} today` : 'Nothing today'}</b><span class="dim">· next two weeks</span>`) +
      `<div class="panel agenda">${all.length ? this._eventRows(all.slice(0, 30)) : '<div class="dim">Nothing in the next two weeks.</div>'}</div>`;
  }
  _binsSheet() {
    const days = this._nextBins().slice(0, 4), next = days[0];
    const rows = days.map((d) => `<div class="panel binday"><h3>${esc(localDay(d.date).toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long'}))}<span class="dim"> · ${binWhen(d)}</span></h3>
        ${d.items.map((b) => `<div class="bin"><span class="bindot big" style="--c:${b.colour}"></span><span class="txt"><div class="name">${esc(b.short)}</div><div class="st">${esc(b.bin)}</div></span></div>`).join('')}</div>`).join('');
    return this._sheetHead('bin', 'ev', 'Bin days', '', next ? `<b>Next: ${binWhen(next)}</b><span class="dim">· reminder on your phone at 7pm the night before</span>` : '<b>No collections found</b>') +
      (rows || '<div class="dim">Nothing in the council calendar for the next four weeks.</div>');
  }
  // Charts answer a finger or a mouse: along the PM2.5 line it reads out the
  // time and value under the pointer; on bar charts it reads out the day.
  _scrub(e) {
    const path = e.composedPath ? e.composedPath() : [];
    const bar = path.find((el) => el.classList?.contains('bar'));
    if (bar && e.type !== 'pointerleave') {
      const out = bar.parentElement?.nextElementSibling;
      if (out?.classList.contains('bars-readout')) out.textContent = bar.dataset.tip;
      for (const b of bar.parentElement.children) b.classList.toggle('picked', b === bar);
      this._touched = Date.now();
      return;
    }
    const wrap = path.find((el) => el.classList?.contains('chart-wrap'));
    const layer = this.shadowRoot.querySelector('.chart-wrap .scrub');
    if (!layer) return;
    if (!wrap || e.type === 'pointerleave' && e.target === wrap) { if (e.pointerType === 'mouse' || e.type === 'pointerleave') layer.hidden = true; return; }
    const c = this._chart, svg = wrap.querySelector('svg');
    if (!c || !svg) return;
    const r = svg.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const t = c.start + f * (c.end - c.start);
    let p = c.pts[0];
    for (const q of c.pts) { if (q[0] <= t) p = q; else break; }
    if (!p || p[0] > t) { layer.hidden = true; return; }
    const v = p[1], word = v <= 12 ? 'Good' : v <= 35 ? 'Fair' : 'Poor';
    layer.hidden = false;
    layer.style.left = `${f * 100}%`;
    layer.querySelector('.dotm').style.top = `${(1 - v / c.max) * 100}%`;
    const tip = layer.querySelector('.tip');
    tip.innerHTML = `<b class="num">${v}</b> µg/m³ · ${word}<br><span class="dim">${hhmm(new Date(t))}</span>`;
    tip.classList.toggle('left', f > 0.7);
    tip.classList.toggle('right', f < 0.3);
    this._touched = Date.now();
  }
  _airChart() {
    const pts = this._history?.points || [], w = 360, h = 110, end = Date.now(), start = end - 24 * 3600e3;
    if (!this._history) return '<div class="chart-empty dim">Loading the last 24 hours…</div>';
    if (pts.length < 2) return '<div class="chart-empty dim">Not enough history yet. It fills in over the next day.</div>';
    const max = Math.max(15, ...pts.map(([, v]) => v)) * 1.15;
    const x = (t) => ((Math.max(start, t) - start) / (end - start)) * w, y = (v) => h - (v / max) * h;
    // A step line: each reading holds until the next.
    let d = '';
    pts.forEach(([t, v], i) => { d += i === 0 ? `M${x(t).toFixed(1)} ${y(v).toFixed(1)}` : `H${x(t).toFixed(1)}V${y(v).toFixed(1)}`; });
    d += `H${w}`;
    const area = `${d}V${h}H${x(pts[0][0]).toFixed(1)}Z`, peak = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
    const band = (v, cls) => (v < max ? `<line x1="0" x2="${w}" y1="${y(v)}" y2="${y(v)}" class="${cls}"/>` : '');
    this._chart = {pts, start, end, max};
    return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="PM2.5 over the last 24 hours, peak ${peak[1]}">
        ${band(12, 'warn')}${band(35, 'bad')}<path d="${area}" class="fill"/><path d="${d}" class="line"/></svg>
        <div class="scrub" hidden><span class="dotm"></span><span class="tip"></span></div></div>
      <div class="chart-axis dim"><span>24 h ago</span><span>Peak ${peak[1]} at ${hhmm(new Date(peak[0]))}</span><span>Now</span></div>`;
  }
  _camerasSheet() {
    const cams = this._config.cameras.filter((cam) => this._s(cam.camera)), online = cams.filter((cam) => ok(this._s(cam.camera))).length;
    return this._sheetHead('camera', 'home', 'Cameras', online === cams.length ? '' : 'red', `<b>${online} of ${cams.length} online</b><span class="dim">· tap one for live view</span>`) +
      `<div class="cams">${cams.map((cam) => this._camTile(cam)).join('')}</div>`;
  }
  _statusSheet(alerts) {
    const c = this._config, backup = this._s(c.backup), remote = this._s(c.remote), phone = num(this._s(c.phone_battery));
    const updates = Object.values(this._hass.states).filter((s) => s.entity_id.startsWith('update.') && s.state === 'on').length;
    const row = (ic, name, st, entity) => `<button class="toggle-row" ${entity ? `data-act="more" data-entity="${entity}"` : ''}><span class="badge">${icon(ic)}</span><span class="txt"><div class="name">${name}</div><div class="st">${st}</div></span>${icon('chevron')}</button>`;
    return this._sheetHead('home', alerts.length ? (alerts.some((a) => a.level === 'red') ? 'act' : 'solar') : 'ok', 'Home status', alerts.length ? 'amber' : '', `<b>${alerts.length ? `${alerts.length} need${alerts.length === 1 ? 's' : ''} you` : 'All systems normal'}</b>`) +
      `<div class="sheet-body"><div class="panel alerts"><h3>Needs you</h3><div class="hint">Alerts clear themselves once they're sorted.</div>
        ${alerts.length ? alerts.map((a) => `<button class="toggle-row" data-act="more" data-entity="${a.entity}"><span class="badge t-${a.level === 'red' ? 'act' : 'solar'}">${icon(a.icon)}</span>
          <span class="txt"><div class="name">${esc(a.title)}</div><div class="st">${esc(a.detail)}</div></span>${icon('chevron')}</button>`).join('') : `<div class="empty">${icon('check')}<span>Nothing needs you.</span></div>`}</div>
        <div class="panel"><h3>Home Assistant</h3><div class="hint">Version ${esc(this._hass.config?.version || '')} · dashboard ${VERSION}</div>
          ${row('backup', 'Last backup', backup ? ago(backup.state) || '—' : 'Not set up', backup?.entity_id)}
          ${row('refresh', 'Updates', updates ? `${updates} ready to install` : 'Everything up to date')}
          ${row('globe', 'Remote access', remote?.state === 'on' ? 'Connected through Home Assistant Cloud' : 'Off', remote?.entity_id)}
          ${phone !== null ? row('phone', "Ross's iPhone", `${phone}% battery`, c.phone_battery) : ''}</div></div>`;
  }
  // ---- House view ----------------------------------------------------------
  _openHouse() {
    if (this._house || !this._hass) return;
    const root = this.shadowRoot.querySelector('.root'), host = document.createElement('div');
    host.className = 'house-host';
    root.insertBefore(host, root.querySelector('.sheets'));
    const c = this._config;
    this._house = new HouseView(host, {
      icon, weather: c.weather, sun: c.sun, purifier: c.purifier, pm25: c.pm25, airQuality: c.air_quality, energy: c.energy_usage, excludeLights: c.exclude_lights,
      layout: c.house_layout || {}, hidden: c.house_hidden || [], floor: c.house_floor, // The garden (the back, +x in the plan) faces south.
      north: c.house_north ?? -90,
      describe: () => this._houseText(),
      onAction: (a, p) => this._houseAction(a, p),
    });
    this._house.update(this._hass, this._themeNow());
  }
  _closeHouse() {
    if (!this._house) return;
    this._house.dispose();
    this._house = null;
    this._houseClosed = true;
    this.shadowRoot.querySelector('.house-host')?.remove();
  }
  _houseText() {
    const h = this._hass, c = this._config;
    const home = Object.values(h.states).filter((s) => s.entity_id.startsWith('person.') && s.state === 'home').map((s) => (s.attributes.friendly_name || '').split(' ')[0]);
    const lit = Object.values(h.states).filter((s) => s.entity_id.startsWith('light.') && s.state === 'on' && !c.exclude_lights.includes(s.entity_id)).length;
    const who = !home.length ? 'Nobody home' : home.length === 1 ? `${esc(home[0])} is home` : `${esc(home.slice(0, -1).join(', '))} and ${esc(home[home.length - 1])} are home`;
    const w = this._s(c.weather), temp = num({state: w?.attributes?.temperature}), r = this._rain();
    const sunS = this._s(c.sun), next = sunS?.state === 'above_horizon' ? sunS.attributes.next_setting : sunS?.attributes?.next_rising;
    return {
      sub: `${who} <span class="dim">·</span> ${lit ? `${lit} light${lit > 1 ? 's' : ''} on` : 'Lights off'}`,
      wx: w ? `<div class="t">${temp === null ? '—' : Math.round(temp)}°<small>${esc(WEATHER_WORDS[w.state] || pretty(w.state))}</small></div>
        <div class="s">${esc(r ? r.text : 'Dry for the next 12 hours')}${next ? ` · ${sunS.state === 'above_horizon' ? 'Sunset' : 'Sunrise'} ${hhmm(new Date(next))}` : ''}</div>` : '',
    };
  }
  async _houseAction(a, p) {
    const c = this._config;
    switch (a) {
      case 'close': this._closeHouse(); return null;
      case 'toggle': this._call('homeassistant', 'toggle', {entity_id: p}); return null;
      case 'lightsOff': this._call('light', 'turn_off', {entity_id: p}); return null;
      case 'lightsOn': this._call('light', 'turn_on', {entity_id: p}); return null;
      case 'more': this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: p}, bubbles: true, composed: true})); return null;
      case 'camera': if (p === c.doorbell) this._openDoor(); else this._sheet = {kind: 'cameras'}; this._render(true); return null;
      case 'purifier': this._sheet = {kind: 'purifier'}; this._render(true); return null;
      case 'saveLayout': return this._saveLayout(p);
      default: return null;
    }
  }
  // Pins are saved into this card's own settings in the dashboard, so the
  // wall tablet, Ross and Evie all see the same layout. If saving there is
  // not allowed (a non-admin account), keep it for this account instead.
  async _saveLayout({layout, hidden}) {
    this._config = {...this._config, house_layout: layout, house_hidden: hidden};
    const path = (location.pathname.split('/')[1] || '').trim();
    try {
      const conf = await this._hass.callWS({type: 'lovelace/config', url_path: path || null});
      let found = 0;
      const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (node.type === 'custom:ross-home') { node.house_layout = layout; node.house_hidden = hidden; found++; }
        for (const k of ['views', 'cards', 'sections', 'card']) if (node[k]) walk(node[k]);
      };
      walk(conf);
      if (!found) throw new Error('Ross Home card not found in this dashboard');
      await this._hass.callWS({type: 'lovelace/config/save', url_path: path || null, config: conf});
      return {ok: true};
    } catch (e) {
      console.warn('ross-home layout', e);
      try {
        await this._hass.callWS({type: 'frontend/set_user_data', key: 'ross_home_house', value: {layout, hidden}});
        return {ok: true, personal: true};
      } catch { return {ok: false}; }
    }
  }
  _close() { this._sheet = null; clearInterval(this._streamTimer); clearTimeout(this._doorTimer); this._render(true); }

  // ---- Actions ------------------------------------------------------------
  _call(domain, service, data) { return this._hass.callService(domain, service, data).catch((e) => console.warn('ross-home', e)); }
  _onClick(e) {
    this._touched = Date.now();
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'close') { if (el.classList.contains('layer') && e.target !== el) return; this._close(); return; }
    e.stopPropagation();
    const c = this._config, a = () => this._airInfo();
    switch (act) {
      case 'sheet': this._sheet = {kind: el.dataset.kind}; this._render(true); break;
      case 'more': this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: el.dataset.entity}, bubbles: true, composed: true})); break;
      case 'toggle': this._call('homeassistant', 'toggle', {entity_id: el.dataset.entity}); break;
      case 'theme': {
        this._themePref = {auto: 'light', light: 'dark', dark: 'auto'}[this._themePref];
        try { localStorage.setItem('ross-home-theme', this._themePref); } catch { /* per-device only */ }
        this._render(true); break;
      }
      case 'sleep': {
        const air = a();
        if (air.preset === 'sleep') this._call('fan', 'set_preset_mode', {entity_id: c.purifier, preset_mode: 'auto'});
        else this._call('fan', 'set_preset_mode', {entity_id: c.purifier, preset_mode: 'sleep'});
        break;
      }
      case 'mode': {
        const m = el.dataset.mode;
        if (m === 'manual') this._call('fan', 'set_percentage', {entity_id: c.purifier, percentage: 34});
        else this._call('fan', 'set_preset_mode', {entity_id: c.purifier, preset_mode: m});
        break;
      }
      case 'speed': this._call('fan', 'set_percentage', {entity_id: c.purifier, percentage: Math.min(100, Number(el.dataset.speed) * 34)}); break;
      case 'power': this._call('fan', a().on ? 'turn_off' : 'turn_on', {entity_id: c.purifier}); break;
      case 'room': {
        const ids = Object.keys(this._hass.states).filter((id) => id.startsWith('light.') && this._areaOf(id) === el.dataset.area && !c.exclude_lights.includes(id));
        const anyOn = ids.some((id) => this._hass.states[id].state === 'on');
        this._call('light', anyOn ? 'turn_off' : 'turn_on', {entity_id: ids});
        break;
      }
      case 'house': this._openHouse(); break;
      case 'tick': this._call('todo', 'update_item', {entity_id: c.todo, item: el.dataset.uid, status: 'completed'}); break;
      case 'nav': history.pushState(null, '', el.dataset.kind); window.dispatchEvent(new CustomEvent('location-changed')); break;
      case 'backup': this._arm('backup', () => this._call('backup', 'create_automatic', {})); break;
      case 'lights-off': this._arm('lights', () => {
        const ids = Object.keys(this._hass.states).filter((id) => id.startsWith('light.') && this._hass.states[id].state === 'on' && !c.exclude_lights.includes(id));
        if (ids.length) this._call('light', 'turn_off', {entity_id: ids});
      }); break;
      default: break;
    }
  }
  // A risky action asks for a second tap within four seconds.
  _arm(key, run) {
    clearTimeout(this._armTimer);
    if (this._armed === key) { this._armed = null; run(); this._render(true); return; }
    this._armed = key;
    this._render(true);
    this._armTimer = setTimeout(() => { this._armed = null; this._render(true); }, 4000);
  }
}

if (!customElements.get('ross-home')) customElements.define('ross-home', RossHome);
window.customCards = window.customCards || [];
window.customCards.push({type: 'ross-home', name: 'Ross Home', description: "Ross's wall-panel dashboard", preview: false});
console.info(`%c ROSS HOME %c ${VERSION} `, 'background:#38bdf8;color:#080b11;font-weight:700', 'background:#080b11;color:#eef2f7');
