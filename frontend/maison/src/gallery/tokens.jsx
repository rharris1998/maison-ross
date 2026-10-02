// The tokens section of the gallery (#29): the type scale, every colour
// in both schemes with what it is for, the temperature scale, the radii and
// spacing, the glass material over a sample gradient, and every other shared
// token by value. It is built from tokens.js's objects, so a token added
// there shows up here; one without a meaning below shows its name alone.
import {DARK, LIGHT, SHARED, THEMED} from '../ui/tokens.js';
import {Button} from '../ui/button.jsx';
import {GalleryGroup, GallerySection} from './section.jsx';

// What each themed token is for. Words for the gallery only.
const MEANING = {
  'm-label': 'Primary text', 'm-label-2': 'Secondary text: details, the date', 'm-label-3': 'Tertiary text: chevrons, disabled, unavailable',
  'm-separator': 'Row separators', 'm-bg': 'The page behind the cards', 'm-card-fill': 'Cards and inset lists', 'm-card-border': 'A card’s hairline edge',
  'm-fill-gray': 'Gray buttons, the segment track, disabled fills', 'm-fill-pressed': 'A pressed row',
  'm-blue': 'Filled buttons, the accent', 'm-blue-text': 'Blue text, tinted and plain buttons', 'm-blue-fill': 'A tinted button’s fill',
  'm-yellow': 'Tile tone', 'm-indigo': 'Tile tone', 'm-indigo-text': 'Indigo text', 'm-pink': 'Tile tone', 'm-green': 'A switch that is on; tile tone',
  'm-orange': 'Warnings and alerts; tile tone', 'm-orange-fill': 'The offline banner', 'm-gray': 'The neutral tile tone', 'm-on-color': 'Glyphs and text on a coloured fill',
  'm-switch-off': 'A switch that is off', 'm-switch-thumb': 'The switch’s thumb', 'm-switch-thumb-shadow': 'The switch thumb’s shadow',
  'm-segment-thumb': 'The selected segment', 'm-segment-thumb-shadow': 'The selected segment’s shadow',
  'm-glass-top': 'Glass, top of its gradient', 'm-glass-bottom': 'Glass, bottom of its gradient', 'm-glass-border': 'Glass’s edge',
  'm-glass-highlight': 'Glass’s inner top light', 'm-glass-shadow': 'Glass’s drop shadow', 'm-glass-selected': 'The current tab on glass',
  'm-glass-fallback': 'Glass where the browser can’t blur', 'm-scrim': 'Behind an open sheet', 'm-sheet-fill': 'A sheet', 'm-focus-ring': 'The keyboard focus ring',
};
const TYPE_USE = {'m-type-title': 'Section header', 'm-type-subhead-strong': 'Button labels, desktop tabs', 'm-type-footnote-strong': 'Segment labels, the date', 'm-type-caption': 'Tab labels and chart axes only'};

const keys = prefix => Object.keys(SHARED).filter(key => key.startsWith(prefix));
const shadow = key => /shadow|highlight/.test(key);
const SCHEMES = THEMED ? [['Light', LIGHT], ['Dark', DARK]] : [['Dark', DARK]];
// Every shared token no group above draws, by value.
const DRAWN = ['m-temp-', 'm-type-', 'm-radius-', 'm-space-'];
const OTHERS = Object.keys(SHARED).filter(key => !DRAWN.some(prefix => key.startsWith(prefix)));

// A colour (or shadow) as it looks in each scheme, on that scheme's page.
function Swatch({name}) {
  return <li className="m-gallery-swatch">
    <span className="m-gallery-swatch__chips">{SCHEMES.map(([scheme, tokens]) =>
      <span key={scheme} className="m-gallery-swatch__chip" style={{background: tokens['m-bg']}} title={`${scheme} ${tokens[name]}`}>
        <i style={shadow(name) ? {background: tokens['m-switch-thumb'], boxShadow: tokens[name]} : {background: tokens[name]}}/></span>)}</span>
    <span className="m-gallery-swatch__text"><b className="m-gallery-token">--{name}</b>{MEANING[name] && <span>{MEANING[name]}</span>}
      <small className="m-num">{SCHEMES.map(([scheme, tokens]) => `${scheme} ${tokens[name]}`).join(' · ')}</small></span>
  </li>;
}

export function TokensSection() {
  return <GallerySection name="tokens" title="Tokens" note={THEMED ? 'Light and dark, following Home Assistant' : 'Dark only'}>
    <GalleryGroup title="Type">
      <ul className="m-gallery-type">{keys('m-type-').map(key => <li key={key}>
        <span style={{font: `var(--${key})`}}>Heating the attic · 19.6°</span>
        <small><b className="m-gallery-token">--{key}</b> {SHARED[key].replace(' var(--m-font)', '')}{TYPE_USE[key] && ` · ${TYPE_USE[key]}`}</small></li>)}</ul>
      <p className="m-gallery-type__num"><span className="m-num" style={{font: 'var(--m-type-large-title)', fontFamily: 'var(--m-font-rounded)'}}>21.5° 1 234 kWh</span><small><b className="m-gallery-token">.m-num</b> the rounded face with tabular digits</small></p>
    </GalleryGroup>
    <GalleryGroup title="Colours">
      <ul className="m-gallery-swatches">{Object.keys(LIGHT).map(key => <Swatch key={key} name={key}/>)}</ul>
    </GalleryGroup>
    <GalleryGroup title="Temperature, rooms only">
      <div className="m-gallery-temp">{keys('m-temp-').map(key => <span key={key} style={{background: `var(--${key})`}}><small className="m-num">{SHARED[key]}</small></span>)}</div>
    </GalleryGroup>
    <GalleryGroup title="Radii">
      <ul className="m-gallery-radii">{keys('m-radius-').map(key => <li key={key}><i style={{borderRadius: `var(--${key})`}}/><small><b className="m-gallery-token">--{key}</b> {SHARED[key]}</small></li>)}</ul>
    </GalleryGroup>
    <GalleryGroup title="Spacing">
      <ul className="m-gallery-space">{keys('m-space-').map(key => <li key={key}><i style={{width: `var(--${key})`}}/><small><b className="m-gallery-token">--{key}</b> {SHARED[key]}</small></li>)}</ul>
    </GalleryGroup>
    <GalleryGroup title="Glass">
      <div className="m-gallery-glass-stage">
        {keys('m-temp-').map(key => <i key={key} style={{background: `var(--${key})`}}/>)}
        <div className="m-gallery-glass"><span>Glass material</span><Button variant="glass" icon="alert" ariaLabel="Glass button"/><Button variant="glass" icon="settings" ariaLabel="Another glass button"/></div>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Sizes, motion and stacking">
      <dl className="m-gallery-values">{OTHERS.map(key => <div key={key}><dt className="m-gallery-token">--{key}</dt><dd className="m-num">{SHARED[key]}</dd></div>)}</dl>
    </GalleryGroup>
  </GallerySection>;
}

// The section's own layout. Colours come from tokens only.
export const tokensGalleryStyles = `
.m-gallery-token{font-weight:600;color:var(--m-label)}
.m-gallery-type{list-style:none;margin:0;padding:0;display:grid;gap:var(--m-space-4)}
.m-gallery-type li,.m-gallery-type__num{display:grid;gap:2px;margin:0;min-width:0;overflow-wrap:anywhere}
.m-gallery-type small,.m-gallery-type__num small,.m-gallery-swatch small,.m-gallery-radii small,.m-gallery-space small{font:var(--m-type-footnote);color:var(--m-label-2)}
.m-gallery-swatches{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:var(--m-space-3)}
.m-gallery-swatch{display:flex;gap:var(--m-space-3);align-items:center;min-width:0}
.m-gallery-swatch__chips{display:flex;flex:none;border-radius:var(--m-radius-row);overflow:hidden;border:.5px solid var(--m-separator)}
.m-gallery-swatch__chip{display:grid;place-items:center;width:44px;height:44px}
.m-gallery-swatch__chip i{width:26px;height:26px;border-radius:var(--m-radius-capsule)}
.m-gallery-swatch__text{display:grid;min-width:0;font:var(--m-type-subhead);color:var(--m-label)}
.m-gallery-swatch__text small{overflow-wrap:anywhere}
.m-gallery-temp{display:flex;border-radius:var(--m-radius-row);overflow:hidden}
.m-gallery-temp span{flex:1;min-width:0;height:44px;display:grid;align-items:end;padding:4px 6px}
.m-gallery-temp small{font:var(--m-type-footnote-strong);color:var(--m-label)}
.m-gallery-radii{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:var(--m-space-4)}
.m-gallery-radii li{display:grid;gap:var(--m-space-2);justify-items:start}
.m-gallery-radii i{width:96px;height:72px;background:var(--m-blue-fill);border:1.5px solid var(--m-blue)}
.m-gallery-space{list-style:none;margin:0;padding:0;display:grid;gap:var(--m-space-2)}
.m-gallery-space li{display:flex;align-items:center;gap:var(--m-space-3)}
.m-gallery-space i{height:12px;background:var(--m-blue);border-radius:2px}
.m-gallery-glass-stage{position:relative;overflow:hidden;min-height:180px;border-radius:var(--m-radius-card);background:linear-gradient(135deg,var(--m-blue),var(--m-indigo) 40%,var(--m-pink) 75%,var(--m-orange));display:grid;place-items:center;padding:var(--m-space-6) var(--m-space-4)}
.m-gallery-glass-stage>i{position:absolute;width:90px;height:90px;border-radius:var(--m-radius-capsule)}
.m-gallery-glass-stage>i:nth-of-type(1){left:6%;top:12%}.m-gallery-glass-stage>i:nth-of-type(2){left:22%;top:52%}.m-gallery-glass-stage>i:nth-of-type(3){left:40%;top:8%}
.m-gallery-glass-stage>i:nth-of-type(4){left:56%;top:48%}.m-gallery-glass-stage>i:nth-of-type(5){left:72%;top:14%}.m-gallery-glass-stage>i:nth-of-type(6){left:86%;top:50%}
.m-gallery-glass{position:relative;display:flex;align-items:center;gap:var(--m-space-2);height:var(--m-tabbar-height);padding:0 var(--m-space-3) 0 var(--m-space-6);border-radius:32px;background:linear-gradient(180deg,var(--m-glass-top),var(--m-glass-bottom));-webkit-backdrop-filter:var(--m-glass-blur);backdrop-filter:var(--m-glass-blur);border:.5px solid var(--m-glass-border);box-shadow:var(--m-glass-highlight),var(--m-glass-shadow);font:var(--m-type-headline);color:var(--m-label)}
.m-gallery-glass>span{margin-right:var(--m-space-2)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.m-gallery-glass{background:var(--m-glass-fallback)}}
.m-gallery-values{margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:var(--m-space-1) var(--m-space-6)}
.m-gallery-values div{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px var(--m-space-3);padding:6px 0;border-bottom:.5px solid var(--m-separator);font:var(--m-type-footnote);min-width:0}
.m-gallery-values dt{white-space:nowrap}
.m-gallery-values dd{flex:1 1 auto;margin:0;color:var(--m-label-2);text-align:right;overflow-wrap:anywhere;min-width:0}
`;
