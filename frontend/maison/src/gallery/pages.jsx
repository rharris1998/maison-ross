// The pages view of the gallery (#29 step 4), opened with ?view=pages:
// Today drawn whole inside the frame, from the values the dashboard draws for
// gallery-snapshots.js's TODAY_PAGES (each a Today fixture under a sky), in a
// window per frame size: every page at a phone's 375px, then two at wide's
// 700px and four at desktop's 1,100px. Nothing is cropped: a window is as
// tall as its page. Its layout containment makes it the containing block of
// the phone's fixed tab bar, so the bar floats at the window's foot, and its
// clip keeps the window from scrolling, so the wide and desktop pills stay at
// its top. Presses act on nothing (the gallery's command is `ignore`).
// From v32 Climate follows in the same windows (CLIMATE_PAGES, at the
// fixtures' own morning), then its sheets drawn in place and whole
// (CLIMATE_SHEETS): a bottom sheet in a phone's 375px, a form sheet 640px
// wide, each around the body the dashboard's sheet draws for its drawer.
// From v33 Energy follows Climate's sheets the same way: its pages
// (ENERGY_PAGES, each at its fixture's own time, noon or 21:04), then its
// sheets (ENERGY_SHEETS); gallery-snapshots.js's sheetSnapshot tells a
// sheet's page by its id.
// From v34 the Car follows Energy's sheets the same way: its pages
// (CAR_PAGES, each at the fixtures' own 12:30), then its sheets
// (CAR_SHEETS).
// From v35 Home status follows the Car's sheets in the same windows
// (SYSTEM_PAGES, at the home fixtures' own 12:30, each window `{size}-system-
// {id}`), then the dialogs drawn in place as the sheets are
// (DIALOG_SNAPSHOTS, each window `{placement}-dialog-{id}`), around the body
// the dashboard's dialog sheet draws for each (DIALOGS).
import {CAR_PAGES, CAR_SHEETS, CLIMATE_PAGES, CLIMATE_SHEETS, DIALOG_SNAPSHOTS, ENERGY_PAGES, ENERGY_SHEETS, SYSTEM_PAGES, TODAY_PAGES, carPageSnapshot, climatePageSnapshot,
  dialogSnapshot, energyPageSnapshot, sheetSnapshot, systemPageSnapshot, todaySnapshot, useScreen} from '../gallery-snapshots.js';
import {Glyph} from '../ui/glyph.jsx';
import {SheetPlacementContext} from '../ui/sheet.jsx';
import {DIALOGS} from '../dialogs.jsx';
import {DRAWERS} from '../drawers.jsx';
import {PAGES} from '../pages.jsx';
import {Frame} from '../frame.jsx';

// Each size's heading and note, and the pages it draws, by TODAY_PAGES id.
const SIZES = [
  {size: 'phone', title: 'Phone', note: '375 px wide, narrower on a phone', pages: ['quiet', 'busy', 'paused', 'unavailable', 'night']},
  {size: 'wide', title: 'Wide', note: '700 px wide, shown from a 760 px viewport', pages: ['busy', 'quiet']},
  {size: 'desktop', title: 'Desktop', note: '1,100 px wide, shown from a 1,180 px viewport', pages: ['busy', 'quiet', 'night', 'unavailable']},
];
const TITLES = Object.fromEntries(TODAY_PAGES.map(({id, title}) => [id, title]));
// Climate's windows by size, by CLIMATE_PAGES id, each size under its
// heading and with Today's note for that size.
const CLIMATE_WINDOWS = [
  {size: 'phone', title: 'Climate · Phone', ids: ['climate-running', 'climate-off', 'climate-away', 'climate-unavailable']},
  {size: 'wide', title: 'Climate · Wide', ids: ['climate-running', 'climate-off']},
  {size: 'desktop', title: 'Climate · Desktop', ids: ['climate-running', 'climate-off', 'climate-override', 'climate-unavailable']},
];
// Energy's likewise, by ENERGY_PAGES id.
const ENERGY_WINDOWS = [
  {size: 'phone', title: 'Energy · Phone', ids: ['energy-covered', 'energy-billing', 'energy-night', 'energy-missing']},
  {size: 'wide', title: 'Energy · Wide', ids: ['energy-covered', 'energy-billing']},
  {size: 'desktop', title: 'Energy · Desktop', ids: ['energy-covered', 'energy-billing', 'energy-night', 'energy-missing']},
];
// The Car's likewise, by CAR_PAGES id.
const CAR_WINDOWS = [
  {size: 'phone', title: 'Car · Phone', ids: ['car-solar', 'car-charge_now', 'car-not_verified', 'car-unplugged', 'car-never_confirmed']},
  {size: 'wide', title: 'Car · Wide', ids: ['car-solar', 'car-not_verified', 'car-unplugged']},
  {size: 'desktop', title: 'Car · Desktop', ids: ['car-solar', 'car-not_verified', 'car-unplugged', 'car-dropout', 'car-override_asleep']},
];
// Home status's likewise, by SYSTEM_PAGES id.
const SYSTEM_WINDOWS = [
  {size: 'phone', title: 'Home status · Phone', ids: ['full', 'quiet', 'missing']},
  {size: 'wide', title: 'Home status · Wide', ids: ['full']},
  {size: 'desktop', title: 'Home status · Desktop', ids: ['full', 'missing']},
];
const NOTES = Object.fromEntries(SIZES.map(({size, note}) => [size, note]));
const CLIMATE_TITLES = Object.fromEntries(CLIMATE_PAGES.map(({id, title}) => [id, title]));
const ENERGY_TITLES = Object.fromEntries(ENERGY_PAGES.map(({id, title}) => [id, title]));
const CAR_TITLES = Object.fromEntries(CAR_PAGES.map(({id, title}) => [id, title]));
const SYSTEM_TITLES = Object.fromEntries(SYSTEM_PAGES.map(({id, title}) => [id, title]));
// Each sheet's placement, heading and note; the Sheet's own placement for
// it (its data-placement, and the SheetPlacementContext its body is drawn
// in); and the sheets' captions, by CLIMATE_SHEETS, ENERGY_SHEETS and
// CAR_SHEETS id, and the dialogs', by DIALOG_SNAPSHOTS id.
const PLACEMENTS = [
  {placement: 'bottom', title: 'Bottom sheet', note: 'Below 700 px: in a 375 px window, narrower on a phone'},
  {placement: 'form', title: 'Form sheet', note: 'From 700 px: 640 px wide, shown from a 760 px viewport'},
];
const SHEET_PLACEMENT = {bottom: 'bottom', form: 'center'};
const SHEET_TITLES = Object.fromEntries([...CLIMATE_SHEETS, ...ENERGY_SHEETS, ...CAR_SHEETS].map(({id, title}) => [id, title]));
const DIALOG_TITLES = Object.fromEntries(DIALOG_SNAPSHOTS.map(({id, title}) => [id, title]));
// A sheet body no drawer or dialog body draws (a page's, until its sheets
// are registered): an empty body in the sheet, never Climate's.
const NoBody = () => null;

// One page in its frame, in a window as wide as `size` and as tall as the
// page, captioned with its fixture's title: `snapshot` is what the element
// would see for page `id`.
function PageWindow({id, size, snapshot, title}) {
  const {chrome, page} = useScreen()(snapshot), Page = PAGES[page.id];
  return <figure className={`m-gallery-page m-gallery-page--${size}`}>
    <div className="m-gallery-page__window" data-gallery-page={`${size}-${id}`}>
      <Frame chrome={chrome}><main className="m-page"><Page value={page}/></main></Frame>
    </div>
    <figcaption className="m-gallery__caption">{title}</figcaption>
  </figure>;
}

// One size's windows under its heading and note: `data` tags the section
// (data-gallery-size for Today's, data-gallery-climate-size for Climate's,
// data-gallery-energy-size for Energy's, data-gallery-car-size for the
// Car's, data-gallery-system-size for Home status's).
function SizeSection({size, title, note, data, children}) {
  return <section className={`m-gallery__section m-gallery-pages-size--${size}`} {...data}>
    <header className="m-gallery__header"><h2 className="m-gallery__heading">{title}</h2><p className="m-gallery__note">{note}</p></header>
    <div className={`m-gallery-pages m-gallery-pages--${size === 'phone' ? 'row' : 'column'}`}>{children}</div>
  </section>;
}

// A sheet drawn in place and whole, in a window `name` that stands in for
// the viewport under the scrim: the Sheet's classes (grabber for a bottom
// sheet, the header with the eyebrow, the title and the close button's
// glass, then the body) around `children`, the body the dashboard's sheet
// draws. The body is drawn in the window's placement, as the Sheet provides
// it, so a chart takes a bottom sheet's box whatever the viewport. The close
// button is its look only: the window isn't a dialog.
function InPlace({name, placement, eyebrow, title, caption, children}) {
  return <figure className={`m-gallery-sheet m-gallery-sheet--${placement}`}>
    <div className="m-gallery-sheet__window" data-gallery-sheet={name}>
      <div className="m-sheet" data-placement={SHEET_PLACEMENT[placement]}><div className="m-sheet__dialog">
        {placement === 'bottom' && <div className="m-sheet__grabber" aria-hidden="true"/>}
        <header className="m-sheet__header">
          <div className="m-sheet__heading">{eyebrow && <p className="m-sheet__eyebrow">{eyebrow}</p>}<h2 className="m-sheet__title">{title}</h2></div>
          <span className="m-button m-button--glass m-button--regular m-button--icon-only m-sheet__close" aria-hidden="true"><Glyph name="close"/></span>
        </header>
        <SheetPlacementContext.Provider value={SHEET_PLACEMENT[placement]}>
          <div className="m-sheet__body">{children}</div>
        </SheetPlacementContext.Provider>
      </div></div>
    </div>
    <figcaption className="m-gallery__caption">{caption}</figcaption>
  </figure>;
}

// One Climate, Energy or Car sheet in place, window `{placement}-{id}`: the
// body DrawerSheet draws for the drawer, DRAWERS[kind], or nothing
// while that kind has none.
function SheetWindow({id, placement}) {
  const {drawer} = useScreen()(sheetSnapshot(id)), Body = DRAWERS[drawer.body.kind] ?? NoBody;
  return <InPlace name={`${placement}-${id}`} placement={placement} eyebrow={drawer.eyebrow} title={drawer.title} caption={SHEET_TITLES[id]}>
    <Body body={drawer.body}/>
  </InPlace>;
}

// One dialog in place (v35), window `{placement}-dialog-{id}`: the body
// DialogSheet draws for it, DIALOGS[kind], or nothing while that kind
// has none.
function DialogWindow({id, placement}) {
  const {dialog} = useScreen()(dialogSnapshot(id)), Body = DIALOGS[dialog.kind] ?? NoBody;
  return <InPlace name={`${placement}-dialog-${id}`} placement={placement} eyebrow={dialog.eyebrow} title={dialog.title} caption={DIALOG_TITLES[id]}>
    <Body value={dialog}/>
  </InPlace>;
}

// One page's sheets drawn in place under its heading, in a group per
// placement: each of `sheets` (CLIMATE_SHEETS, ENERGY_SHEETS, CAR_SHEETS or
// DIALOG_SNAPSHOTS) drawn by `Window` (SheetWindow, or DialogWindow for the
// dialogs). `data` tags the section (data-gallery-sheets for Climate's,
// data-gallery-energy-sheets for Energy's, data-gallery-car-sheets for the
// Car's, data-gallery-dialogs for the dialogs).
function SheetsSection({title, data, sheets, Window = SheetWindow}) {
  return <section className="m-gallery__section m-gallery-pages-sheets" {...data}>
    <header className="m-gallery__header"><h2 className="m-gallery__heading">{title}</h2><p className="m-gallery__note">Each drawn in place and whole, as the sheet opens over the page</p></header>
    {PLACEMENTS.map(({placement, title, note}) => <div key={placement} className={`m-gallery__group m-gallery-sheets-group--${placement}`}>
      <h3 className="m-gallery__subheading">{title}</h3><p className="m-gallery__note">{note}</p>
      <div className="m-gallery-pages m-gallery-pages--row">{sheets.map(({id}) => <Window key={id} id={id} placement={placement}/>)}</div>
    </div>)}
  </section>;
}

/**
 * The gallery's pages view: Today, then Climate, in every frame size,
 * then Climate's sheets, then Energy and its sheets, then the Car and its
 * sheets likewise, then Home status and the dialogs.
 *
 * DOM: `main.m-gallery.m-gallery--pages[data-gallery-ready=true][data-gallery-view=pages]`
 * holding the intro, then:
 * - per size (phone, wide, desktop) Today's
 *   `section.m-gallery__section.m-gallery-pages-size--{size}[data-gallery-size]`
 *   with its `h2.m-gallery__heading` and note, and its windows: each a
 *   `figure.m-gallery-page.m-gallery-page--{size}` holding
 *   `div.m-gallery-page__window[data-gallery-page="{size}-{id}"]` (the Frame
 *   and the page in its `main.m-page`) and a figcaption with the
 *   fixture's title;
 * - per size Climate's, the same with `[data-gallery-climate-size]` in place
 *   of `[data-gallery-size]`, and windows `[data-gallery-page="{size}-climate-…"]`
 *   (CLIMATE_PAGES ids start `climate-`, so a window's first word is its size);
 * - `section.m-gallery__section.m-gallery-pages-sheets[data-gallery-sheets]`,
 *   with a `div.m-gallery__group.m-gallery-sheets-group--{bottom|form}` per
 *   placement (`h3.m-gallery__subheading`, note), each holding a
 *   `figure.m-gallery-sheet.m-gallery-sheet--{placement}` per CLIMATE_SHEETS
 *   id: `div.m-gallery-sheet__window[data-gallery-sheet="{placement}-{id}"]`
 *   (the static `div.m-sheet[data-placement=bottom|center]`, its body in a
 *   SheetPlacementContext of the same placement, no tab bar) and a
 *   figcaption with the fixture's title;
 * - per size Energy's, as Climate's with `[data-gallery-energy-size]` and
 *   windows `[data-gallery-page="{size}-energy-…"]` (ENERGY_PAGES ids);
 * - Energy's sheets, as Climate's with `[data-gallery-energy-sheets]` in
 *   place of `[data-gallery-sheets]`, per ENERGY_SHEETS id
 *   (`[data-gallery-sheet="{placement}-energy-…"]`);
 * - per size the Car's, as Climate's with `[data-gallery-car-size]` and
 *   windows `[data-gallery-page="{size}-car-…"]` (CAR_PAGES ids);
 * - the Car's sheets, as Climate's with `[data-gallery-car-sheets]`, per
 *   CAR_SHEETS id (`[data-gallery-sheet="{placement}-car-…"]`);
 * - per size Home status's (v35), as Climate's with
 *   `[data-gallery-system-size]` and windows
 *   `[data-gallery-page="{size}-system-{id}"]` (SYSTEM_PAGES ids);
 * - the dialogs, as Climate's sheets with `[data-gallery-dialogs]`, per
 *   DIALOG_SNAPSHOTS id (`[data-gallery-sheet="{placement}-dialog-{id}"]`),
 *   each around DIALOGS[kind].
 * A sheet whose kind no drawer or dialog body draws yet has an empty body.
 * Phone windows and bottom sheets sit side by side; wide and desktop windows
 * one per row, and only on a viewport that holds them, as form sheets
 * (pagesGalleryStyles).
 */
export function PagesGallery() {
  return <main className="m-gallery m-gallery--pages" data-gallery-ready="true" data-gallery-view="pages">
    <header className="m-gallery__intro">
      <p className="m-gallery__eyebrow">Maison · deterministic synthetic fixtures</p>
      <h1 className="m-gallery__title">Pages in every frame</h1>
      <p className="m-gallery__lead">Today, Climate, Energy, the Car and Home status drawn whole from the values the dashboard draws for each fixture, under its sky, at each frame’s width, Climate, Energy and the Car each followed by their sheets, Home status by the dialogs; presses act on nothing.</p>
    </header>
    {SIZES.map(({size, title, note, pages}) => <SizeSection key={size} size={size} title={title} note={note} data={{'data-gallery-size': size}}>
      {pages.map(id => <PageWindow key={id} id={id} size={size} snapshot={todaySnapshot(id)} title={TITLES[id]}/>)}
    </SizeSection>)}
    {CLIMATE_WINDOWS.map(({size, title, ids}) => <SizeSection key={size} size={size} title={title} note={NOTES[size]} data={{'data-gallery-climate-size': size}}>
      {ids.map(id => <PageWindow key={id} id={id} size={size} snapshot={climatePageSnapshot(id)} title={CLIMATE_TITLES[id]}/>)}
    </SizeSection>)}
    <SheetsSection title="Climate · Sheets" data={{'data-gallery-sheets': ''}} sheets={CLIMATE_SHEETS}/>
    {ENERGY_WINDOWS.map(({size, title, ids}) => <SizeSection key={size} size={size} title={title} note={NOTES[size]} data={{'data-gallery-energy-size': size}}>
      {ids.map(id => <PageWindow key={id} id={id} size={size} snapshot={energyPageSnapshot(id)} title={ENERGY_TITLES[id]}/>)}
    </SizeSection>)}
    <SheetsSection title="Energy · Sheets" data={{'data-gallery-energy-sheets': ''}} sheets={ENERGY_SHEETS}/>
    {CAR_WINDOWS.map(({size, title, ids}) => <SizeSection key={size} size={size} title={title} note={NOTES[size]} data={{'data-gallery-car-size': size}}>
      {ids.map(id => <PageWindow key={id} id={id} size={size} snapshot={carPageSnapshot(id)} title={CAR_TITLES[id]}/>)}
    </SizeSection>)}
    <SheetsSection title="Car · Sheets" data={{'data-gallery-car-sheets': ''}} sheets={CAR_SHEETS}/>
    {SYSTEM_WINDOWS.map(({size, title, ids}) => <SizeSection key={size} size={size} title={title} note={NOTES[size]} data={{'data-gallery-system-size': size}}>
      {ids.map(id => <PageWindow key={id} id={`system-${id}`} size={size} snapshot={systemPageSnapshot(id)} title={SYSTEM_TITLES[id]}/>)}
    </SizeSection>)}
    <SheetsSection title="Dialogs" data={{'data-gallery-dialogs': ''}} sheets={DIALOG_SNAPSHOTS} Window={DialogWindow}/>
  </main>;
}

// The view's column is the whole viewport less its inset, so a desktop
// window fits in it. Phone windows wrap side by side, narrower on a phone;
// wide and desktop ones stack, each shown only from a viewport whose column
// holds it (700 + 2 × 24px and 1,100 + 2 × 32px, rounded up for a scrollbar),
// so the document never scrolls sideways. A window's content box is its
// size exactly (its edge is a shadow, not a border), which is the width the
// frame measures its layout from. WebKit paints only the background of a
// fixed element whose containing block comes from `contain`, not its tabs;
// a compositing layer of its own for the phone bar makes it paint them, as
// in frames.jsx.
// A sheet's window is contained and clipped the same way, dimmed by the
// scrim as the page under a sheet is. The Sheet in it is laid out in the
// window's flow rather than pinned to a viewport, and has no height cap, so
// its body shows whole and never scrolls: a bottom sheet 8px off the
// window's edges under a status bar's gap, a form sheet 640px wide (as
// ui/sheet.css.js draws it on any viewport from 688px) in 24px of scrim.
// Form sheets show from a 760px viewport, whose column holds one (688 +
// 2 × 24px, rounded up for a scrollbar, as wide pages do).
export const pagesGalleryStyles = `
.m-gallery--pages{max-width:none}
.m-gallery-pages{display:flex;gap:var(--m-space-6) var(--m-space-5);align-items:flex-start;min-width:0}
.m-gallery-pages--row{flex-wrap:wrap}
.m-gallery-pages--column{flex-direction:column}
.m-gallery-page{margin:0;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-2);min-width:0;max-width:100%}
.m-gallery-page--phone{width:375px}
.m-gallery-page--wide{width:700px}
.m-gallery-page--desktop{width:1100px}
.m-gallery-page__window{position:relative;contain:layout paint;overflow:hidden;background:var(--m-bg);box-shadow:0 0 0 .5px var(--m-separator);border-radius:var(--m-radius-card)}
.m-gallery-page--phone .m-gallery-page__window{border-radius:var(--m-radius-screen)}
.m-gallery-page__window .m-app[data-layout=phone] .m-tabbar{transform:translateZ(0)}
.m-gallery-pages-size--wide,.m-gallery-pages-size--desktop{display:none}
@media (min-width:760px){.m-gallery-pages-size--wide{display:grid}}
@media (min-width:1180px){.m-gallery-pages-size--desktop{display:grid}}
.m-gallery-sheet{margin:0;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-2);min-width:0;max-width:100%}
.m-gallery-sheet--bottom{width:375px}
.m-gallery-sheet--form{width:688px}
.m-gallery-sheet__window{position:relative;contain:layout paint;overflow:hidden;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr);align-content:end;padding:28px 8px 8px;background:linear-gradient(var(--m-scrim),var(--m-scrim)),var(--m-bg);box-shadow:0 0 0 .5px var(--m-separator);border-radius:var(--m-radius-screen)}
.m-gallery-sheet--form .m-gallery-sheet__window{padding:var(--m-space-6);border-radius:var(--m-radius-card)}
.m-gallery-sheet__window .m-sheet[data-placement]{position:relative;inset:auto;width:auto;max-height:none;min-width:0}
.m-gallery-sheets-group--form{display:none}
@media (min-width:760px){.m-gallery-sheets-group--form{display:grid}}
`;
