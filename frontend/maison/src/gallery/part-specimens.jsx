// The parts in the gallery (#29 step 4), each in every state: the ring
// at 0, 62 and 100, unknown and stale, with its reserve and limit ticks, in
// both sizes; the segmented bar full, partial and empty, with its legend;
// the glance chips in every tone and the room scale, then disabled, pressed
// and focused; the figure in both sizes with its label above and beside;
// the quiet line with and without buttons, on a wide line and a phone's.
// Links and Controls are plain objects of the values' shape, and the words
// are the gallery's, the kind the values write. Pressed and keyboard focus
// are states React Aria sets only while they happen, so they are drawn as
// frozen copies: the same classes and data attribute on an inert element.
// Presses act on nothing.
import {Glyph} from '../ui/glyph.jsx';
import {IntentButton} from '../ui/button.jsx';
import {TONES} from '../ui/list.jsx';
import {Ring} from '../ui/ring.jsx';
import {Legend, SegmentBar} from '../ui/segment-bar.jsx';
import {Figure} from '../ui/figure.jsx';
import {GlanceChips} from '../ui/glance.jsx';
import {QuietLine} from '../ui/quiet.jsx';
import {GalleryGroup, Specimen} from './section.jsx';

const INTENT = {command: 'gallery'};
const link = ariaLabel => ({intent: INTENT, enabled: true, ariaLabel});
const control = (label, icon) => ({intent: INTENT, enabled: true, label, icon});

// The Car's ring: its reserve and limit, and each state the battery can be
// in, as the Car widget draws them (green only while charging).
const TICKS = [{at: 50, kind: 'reserve'}, {at: 80, kind: 'limit'}];
const RINGS = [
  {key: 'charging', value: 62, tone: 'green', label: '62%', caption: '62%, charging: green'},
  {key: 'waiting', value: 62, tone: 'gray', label: '62%', caption: '62%, not charging: gray'},
  {key: 'empty', value: 0, tone: 'gray', label: '0%', caption: '0: the start cap alone'},
  {key: 'full', value: 100, tone: 'green', label: '100%', caption: '100: the whole ring'},
  {key: 'unknown', value: null, tone: 'gray', label: '—', caption: 'Unknown: dashed, nothing filled'},
  {key: 'stale', value: 62, tone: 'gray', stale: true, label: '62%', caption: 'Last confirmed: the arc dimmed'},
];
const ringName = ({value, stale}) => `${value === null ? 'Battery unknown' : `Battery ${value}%`}, ready reserve 50%, charge limit 80%${stale ? ', last confirmed' : ''}`;

// Today's energy four ways: every reading, no export (its share of 0 left
// out), nothing generated or used yet (a real zero), and a reading missing.
const BARS = [
  {key: 'full', caption: 'Full: used at home, exported and from the grid', segments: [{key: 'home', tone: 'yellow', share: 6.6 / 15.8}, {key: 'export', tone: 'green', share: 4.9 / 15.8}, {key: 'import', tone: 'indigo', share: 4.6 / 15.8}],
    legend: [{tone: 'yellow', text: '6.6 used at home'}, {tone: 'green', text: '4.9 exported'}, {tone: 'indigo', text: '4.6 from the grid'}],
    ariaLabel: 'Energy today, in kWh: 6.6 used at home, 4.9 exported, 4.6 from the grid'},
  {key: 'partial', caption: 'Partial: nothing exported, so two segments', segments: [{key: 'home', tone: 'yellow', share: 2.1 / 9.4}, {key: 'import', tone: 'indigo', share: 7.3 / 9.4}],
    legend: [{tone: 'yellow', text: '2.1 used at home'}, {tone: 'green', text: '0.0 exported'}, {tone: 'indigo', text: '7.3 from the grid'}],
    ariaLabel: 'Energy today, in kWh: 2.1 used at home, 0.0 exported, 7.3 from the grid'},
  {key: 'zero', empty: 'zero', caption: 'Zero: nothing generated or used yet, a solid track', segments: [],
    legend: [{tone: 'yellow', text: '0.0 used at home'}, {tone: 'green', text: '0.0 exported'}, {tone: 'indigo', text: '0.0 from the grid'}],
    ariaLabel: 'Energy today: nothing generated or used yet'},
  {key: 'missing', caption: 'Missing: a reading is missing, a dashed track', segments: [],
    legend: [{tone: 'yellow', text: '— used at home'}, {tone: 'green', text: '— exported'}, {tone: 'indigo', text: '4.6 from the grid'}],
    ariaLabel: 'Energy today: some readings are missing'},
];

// A chip per tone, the room scale first, with a glyph and words of the kind
// the glance draws.
const CHIP_WORDS = {
  temperature: ['climate', 'Climate', '22.7–24.2° inside'], yellow: ['sun', 'Energy', '2.84 kW solar'], indigo: ['grid', 'Energy', '316 W from grid'],
  pink: ['grid', 'Energy', '1.20 kW · peak'], green: ['car', 'Car', 'Charging · 64%'], orange: ['alert', 'Home', '2 need you'], gray: ['car', 'Car', '62% · waiting'],
};
const chip = tone => {
  const [icon, title, line] = CHIP_WORDS[tone];
  return {id: tone, icon, tone, title, line, link: link(`${title}: ${line}. Open ${title}`)};
};
const CHIPS = ['temperature', ...TONES].map(chip);

// A chip frozen in a state React Aria sets only while it happens: the same
// classes on an inert div.
const FrozenChip = ({item: {icon, tone, title, line}, state}) => <div className="m-glance__chip m-focusable" {...{[`data-${state}`]: ''}} aria-hidden="true">
  <span className={`m-glance__dot m-tone-${tone}`}><Glyph name={icon}/></span>
  <span className="m-glance__copy"><span className="m-glance__title">{title}</span><span className="m-glance__line">{line}</span></span>
</div>;

// The vacuum's quiet line, docked and cleaning.
const DOCKED = {icon: 'vacuum', text: 'Roborock is docked, battery 100%'};
const CLEANING = {icon: 'vacuum', text: 'Roborock is cleaning · 40%'};
const Buttons = () => [<IntentButton key="run" action={control('Pause', 'pause')} variant="gray"/>, <IntentButton key="dock" action={control('Dock', 'dock')} variant="gray"/>];

export function PartSpecimens() {
  return <>
    <GalleryGroup title="Rings">
      <div className="m-gallery-parts">
        {RINGS.map(ring => <Specimen key={ring.key} caption={ring.caption}><Ring {...ring} ticks={TICKS} ariaLabel={ringName(ring)}/></Specimen>)}
      </div>
      <div className="m-gallery-parts">
        {RINGS.map(ring => <Specimen key={ring.key} caption={`Small: ${ring.caption.charAt(0).toLowerCase()}${ring.caption.slice(1)}`}>
          <Ring {...ring} ticks={TICKS} ariaLabel={ringName(ring)} size="small"/>
        </Specimen>)}
      </div>
    </GalleryGroup>
    <GalleryGroup title="Segmented bars and legends">
      <div className="m-gallery-parts m-gallery-parts--columns">
        {BARS.map(bar => <Specimen key={bar.key} caption={bar.caption}><div className="m-gallery-parts__bar">
          <SegmentBar segments={bar.segments} ariaLabel={bar.ariaLabel} empty={bar.empty}/><Legend items={bar.legend}/>
        </div></Specimen>)}
      </div>
    </GalleryGroup>
    <GalleryGroup title="Glance chips">
      <div className="m-gallery-parts m-gallery-parts--stack">
        <Specimen caption="Every tone, the room scale first; the row scrolls on its own and snaps, and never pans the page"><GlanceChips label="At a glance" items={CHIPS}/></Specimen>
        <Specimen caption="Disabled, pressed and keyboard focus"><div className="m-gallery-parts__chips">
          <GlanceChips label="States" items={[{...CHIPS[1], id: 'disabled', link: {...CHIPS[1].link, enabled: false}}]}/>
          <FrozenChip item={CHIPS[4]} state="pressed"/><FrozenChip item={CHIPS[6]} state="focus-visible"/>
        </div></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Figures">
      <div className="m-gallery-parts">
        <Specimen caption="Large, the label above"><Figure label="Solar generated" value="11.5" unit="kWh"/></Specimen>
        <Specimen caption="Large, the label beside"><Figure label="Solar generated" value="11.5" unit="kWh" labelPlacement="beside"/></Specimen>
        <Specimen caption="Large, no label"><Figure value="2.84" unit="kW"/></Specimen>
        <Specimen caption="Unknown: a dash, no unit"><Figure label="Solar generated" value="—" unit=""/></Specimen>
        <Specimen caption="Regular, the label above"><Figure label="Exported" value="4.9" unit="kWh" size="regular"/></Specimen>
        <Specimen caption="Regular, the label beside"><Figure label="Exported" value="4.9" unit="kWh" size="regular" labelPlacement="beside"/></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Quiet lines">
      <div className="m-gallery-parts m-gallery-parts--stack">
        <Specimen caption="Nothing to do: the glyph and the line"><QuietLine {...DOCKED}/></Specimen>
        <Specimen caption="While it runs: its buttons at the end"><QuietLine {...CLEANING}><Buttons/></QuietLine></Specimen>
        <Specimen caption="On a phone’s width the buttons wrap under the text"><div className="m-gallery-parts__phone"><QuietLine {...CLEANING}><Buttons/></QuietLine></div></Specimen>
      </div>
    </GalleryGroup>
  </>;
}

// The parts' own layout: rings and figures side by side, bars in columns as
// wide as a phone's, and the chips and quiet lines across the section, each
// able to shrink to the page, so a scrolling row never widens it.
export const partSpecimensStyles = `
.m-gallery-parts{display:flex;flex-wrap:wrap;gap:var(--m-space-6) var(--m-space-5);align-items:flex-start;min-width:0}
.m-gallery-parts--columns{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))}
.m-gallery-parts--stack{display:grid;grid-template-columns:minmax(0,1fr)}
.m-gallery-parts--columns>.m-gallery__specimen,.m-gallery-parts--stack>.m-gallery__specimen{justify-items:stretch}
.m-gallery-parts--columns .m-gallery__stage,.m-gallery-parts--stack .m-gallery__stage{display:block;min-width:0}
.m-gallery-parts__bar{display:grid;gap:10px;min-width:0}
.m-gallery-parts__chips{display:flex;flex-wrap:wrap;align-items:center;gap:10px;min-width:0}
.m-gallery-parts__chips>.m-glance{flex:none;overflow:visible}
.m-gallery-parts__phone{max-width:343px}
`;
