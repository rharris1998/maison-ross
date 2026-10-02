// The lists section of the gallery (#29): inset and plain lists, rows in
// every tone, weight and state (unavailable among them), and cards, one under
// a section title, drawn from the values the pages and sheets draw (Climate,
// Home status, Today, Energy and the Car) wherever a value has the shape.
// Pressed and keyboard focus are states React Aria sets only while they
// happen, so they are drawn as frozen copies: the same classes and data
// attribute on an inert element. Presses act on nothing.
import {Card, SectionTitle} from '../ui/card.jsx';
import {Glyph} from '../ui/glyph.jsx';
import {List, ListRow, TONES, TONE_ALIASES, toneOf} from '../ui/list.jsx';
import {CAR_FIXTURES} from '../../fixtures/car-fixtures.js';
import {HOME_NOW} from '../../fixtures/home-fixtures.js';
import {TODAY_NOW} from '../../fixtures/today-fixtures.js';
import {HOME, TODAY_BUSY, carSheetSnapshot, carSnapshot, climateSnapshot, pageSnapshot, systemPageSnapshot, useScreen} from '../gallery-snapshots.js';
import {ZoneRow} from '../pages/climate.jsx';
import {GalleryGroup, GallerySection, Specimen} from './section.jsx';

// Gallery words only: a glyph and a name per tone, and the legacy names that
// map onto it.
const TONE_ICON = {yellow: 'sun', indigo: 'moon', pink: 'music', green: 'leaf', orange: 'alert', gray: 'settings'};
const title = word => word[0].toUpperCase() + word.slice(1);
const aliases = tone => Object.keys(TONE_ALIASES).filter(name => TONE_ALIASES[name] === tone);
const GALLERY_LINK = {intent: {command: 'gallery'}, enabled: true};
// Readings with a sensible name, the Unavailable one among them, and the
// plugs' power readings.
const READINGS = ['Living room temperature', 'Hallway motion', 'Front door', 'Cellar temperature'];
const POWER = ['Dishwasher plug power', 'Dryer plug power', 'Garage socket power'];

// A Car sheet's reading as the sheet draws it: its tone tile (dashed while
// unavailable), its title over its detail, its value; static without a link.
const CarReading = ({row}) => <ListRow link={row.link} icon={row.icon} tone={row.tone} title={row.title} detail={row.detail ?? undefined} value={row.value}
  unavailable={row.unavailable === true}/>;

// A row frozen in a state React Aria sets only while it happens: the same
// classes as a pressable row on an inert div.
const Frozen = ({row, state}) => <div className="m-row m-row--pressable m-focusable" {...{[`data-${state}`]: ''}} aria-hidden="true">
  <span className={`m-row__tile m-tone-${toneOf(row.tone)}`}><Glyph name={row.icon}/></span>
  <span className="m-row__copy"><span className="m-row__title">{row.title}</span><span className="m-row__detail">{row.detail}</span></span>
  <Glyph name="chevron" className="m-row__chevron"/></div>;

export function ListsSection() {
  const screen = useScreen();
  const climate = screen(climateSnapshot()).page;
  const alerts = screen(pageSnapshot(HOME, 'system', HOME_NOW, undefined, {kind: 'alerts'})).dialog.rows;
  const system = screen(pageSnapshot(HOME, 'system', HOME_NOW, {query: '', category: 'all', limit: 200})).page;
  const reading = name => system.sensors.rows.find(row => row.title === name);
  const readings = READINGS.map(reading).filter(Boolean), power = POWER.map(reading).filter(Boolean);
  const devices = screen(systemPageSnapshot('quiet')).page.devices;
  // Today's Coming up, ending on its next collection.
  const {upcoming} = screen(pageSnapshot(TODAY_BUSY, 'today', TODAY_NOW)).page, collection = upcoming.rows.at(-1);
  const {billCard, capCard} = screen(pageSnapshot(HOME, 'energy', HOME_NOW)).page;
  const car = screen(carSnapshot(CAR_FIXTURES.find(fixture => fixture.id === 'solar'), 'car')).page;
  const battery = screen(carSheetSnapshot('car-battery')).drawer.body.readings.rows, sources = screen(carSheetSnapshot('car-charging-energy')).drawer.body.rows;
  const cellar = readings.find(row => row.unavailable), unread = screen(climateSnapshot('sensors_unavailable')).page.zones[0];
  return <GallerySection name="lists" title="Lists and cards" note="Inset lists on the page, plain lists inside cards; the hairline starts where the text does">
    <GalleryGroup title="Tones">
      <div className="m-gallery-lists">
        <Specimen caption="Tinted tiles, one per tone; blue is not a tone, it means press. The detail names the legacy tones that map onto it"><List ariaLabel="Tones">
          {TONES.map(tone => <ListRow key={tone} link={GALLERY_LINK} icon={TONE_ICON[tone]} tone={tone} title={title(tone)}
            detail={aliases(tone).length ? `Also ${aliases(tone).join(', ')}` : `var(--m-${tone})`}/>)}
        </List></Specimen>
        <Specimen caption="Home alerts, tone amber, strong: named by their text"><List>{alerts.map(row => <ListRow key={row.link.intent.entity} {...row} strong/>)}</List></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Primary rows">
      <div className="m-gallery-lists">
        <Specimen caption="Zones, drawn by the Climate page’s own row: strong titles, glyphs in the room’s colour, and the reading over its target bar in place of the chevron; each named by its link’s ariaLabel alone, which says all the row shows"><List ariaLabel={climate.zonesTitle}>
          {climate.zones.map(zone => <ZoneRow key={zone.id} zone={zone}/>)}
        </List></Specimen>
        <Specimen caption="A strong setting with an accessory: the Car’s Automatic charging as a phone lists it (a placeholder for its switch)"><List>
          <ListRow strong title={car.automatic.title} detail={car.automatic.detail} accessory={<span className="m-gallery-pill" aria-hidden="true"/>}/>
        </List></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Values and trailing">
      <div className="m-gallery-lists">
        <Specimen caption="Home status readings: a value, then the chevron"><List>{readings.map(row => <ListRow key={row.link.intent.entity} {...row}/>)}</List></Specimen>
        <Specimen caption="Vacuum maintenance, as Home status draws it: named by each link’s ariaLabel, described by its value; Due on an orange tile"><List>
          {system.vacuum.rows.map(row => <ListRow key={row.title} link={row.link} icon={row.icon} tone={row.tone ?? 'gray'} title={row.title} value={row.value}/>)}
        </List></Specimen>
        <Specimen caption="Plugs’ power readings: the value in place of the chevron (trailing null)"><List>{power.map(row => <ListRow key={row.link.intent.entity} {...row} trailing={null}/>)}</List></Specimen>
        <Specimen caption="The Car’s Battery readings: tone tiles, a detail where there is one; Ready reserve opens nothing, so it is static, with no chevron"><List>
          {battery.map(row => <CarReading key={row.title} row={row}/>)}
        </List></Specimen>
        <Specimen caption="No tile: Energy’s bill and cap credit as a phone lists them, figure values; the hairline starts at 16px"><List>
          {[billCard, capCard].map(card => <ListRow key={card.title} link={card.link} title={card.title} detail={card.line} value={card.figure} figure/>)}
        </List></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="States">
      <div className="m-gallery-lists">
        <Specimen caption="Disabled: the link’s enabled is false"><List><ListRow {...alerts[0]} link={{...alerts[0].link, enabled: false}}/></List></Specimen>
        <Specimen caption="Pressed, the middle row: its hairlines hide"><List>
          <ListRow {...alerts[0]}/><Frozen row={alerts[1]} state="pressed"/><ListRow {...collection}/>
        </List></Specimen>
        <Specimen caption="Keyboard focus, the first row"><List><Frozen row={alerts[0]} state="focus-visible"/><ListRow {...alerts[1]}/></List></Specimen>
        <Specimen caption="Unavailable, pressable: Home status’s Cellar temperature, from its value; a dashed tile, never off"><List>
          <ListRow {...readings[0]}/><ListRow {...cellar}/>
        </List></Specimen>
        <Specimen caption="Unavailable, static: a zone with no reading; a dashed tile, never a colour, its figure “—”"><List>
          <ListRow icon={unread.opener.icon} strong title={unread.opener.name} detail={unread.reading.line} value={unread.reading.reading} figure unavailable/>
        </List></Specimen>
        <Specimen caption="A long title wraps; the value keeps its place"><List>
          <ListRow link={readings[0].link} icon="climate" tone="orange" title="Living room temperature, measured by the sensor beside the bookcase" detail={readings[0].detail} value={readings[0].value}/>
        </List></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Cards">
      <div className="m-gallery-cards">
        <Card title={devices.title}><List variant="plain">{devices.rows.map(row => <ListRow key={row.title} {...row}/>)}</List>
          <p className="m-gallery-card-text">{devices.note}</p></Card>
        <SectionTitle>{upcoming.title}</SectionTitle>
        <Card><List variant="plain" ariaLabel={upcoming.title}>{upcoming.rows.map(row => <ListRow key={row.title} {...row}/>)}</List></Card>
        <Card title={car.chargingEnergy.title}><List variant="plain">{sources.map(row => <CarReading key={row.title} row={row}/>)}</List></Card>
        <p className="m-gallery__caption">Cards with a headline title and a plain list, and one under a section title: Home status’s key devices with their footnote, Today’s Coming up under its title as a phone stacks it, its list named for a screen reader, then the Car’s charging energy, each row opening its meter</p>
      </div>
    </GalleryGroup>
  </GallerySection>;
}

// The section's own layout: lists in columns as wide as a phone's, cards in
// a column as a page stacks them, and the switch-sized placeholder an
// accessory stands in.
export const listsGalleryStyles = `
.m-gallery-lists{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:var(--m-space-5) var(--m-space-6);align-items:start}
.m-gallery-lists .m-gallery__specimen{justify-items:stretch}
.m-gallery-lists .m-gallery__stage{display:block}
.m-gallery-cards{display:grid;gap:var(--m-space-3);max-width:420px}
.m-gallery-pill{display:block;width:var(--m-switch-w);height:var(--m-switch-h);border-radius:var(--m-radius-capsule);background:var(--m-fill-gray)}
.m-gallery-card-text{margin:var(--m-space-2) 0 0;font:var(--m-type-subhead);color:var(--m-label-2)}
`;
