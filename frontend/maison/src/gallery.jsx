// The gallery bundle's entry (vendor/maison-gallery.js): Maison's gallery
// (#29), its own controls in every state, on its tokens, in light or dark,
// and with `view: 'pages'` its pages in every frame size. It draws with the
// dashboard's own styles (App's, app.css.js), so a control looks as it will
// in Home Assistant, and builds its examples from real screen values:
// dev/maison/gallery.html passes the served screen.js's screen() in. Presses
// act on nothing. It loads the shadow-DOM adapter first, as the dashboard
// does.
import './shadow-dom.js';
import {createRoot} from 'react-dom/client';
import {UNSAFE_PortalProvider} from 'react-aria/PortalProvider';
import {CommandContext, PortalContext} from './contexts.js';
import {NativeContext} from './native.jsx';
import {ScreenContext, ignore, placeholderCard} from './gallery-snapshots.js';
import {appStyles} from './app.css.js';
import {TokensSection, tokensGalleryStyles} from './gallery/tokens.jsx';
import {ButtonsSection, buttonsGalleryStyles} from './gallery/buttons.jsx';
import {SwitchesSection, switchesGalleryStyles} from './gallery/switches.jsx';
import {SegmentedSection, segmentedGalleryStyles} from './gallery/segmented.jsx';
import {SteppersSection, steppersGalleryStyles} from './gallery/steppers.jsx';
import {ListsSection, listsGalleryStyles} from './gallery/lists.jsx';
import {SheetsSection, sheetsGalleryStyles} from './gallery/sheets.jsx';
import {SkySection, skyGalleryStyles} from './gallery/sky.jsx';
import {HeroesSection, heroesGalleryStyles} from './gallery/heroes.jsx';
import {FramesSection, framesGalleryStyles} from './gallery/frames.jsx';
import {WidgetsSection, widgetsGalleryStyles} from './gallery/widgets.jsx';
import {DetailsSection, detailsGalleryStyles} from './gallery/details.jsx';
import {PagesGallery, pagesGalleryStyles} from './gallery/pages.jsx';

// The gallery's own page, section and specimen layout, then each section's.
const galleryStyles = `
:host{background:var(--m-bg);min-height:100vh}
.m-gallery{box-sizing:border-box;max-width:var(--m-content-max);margin:0 auto;padding:var(--m-space-7) var(--m-page-inset) var(--m-space-8);display:grid;gap:var(--m-space-8);color:var(--m-label)}
.m-gallery__intro{display:grid;gap:var(--m-space-1)}
.m-gallery__eyebrow{margin:0;font:var(--m-type-footnote-strong);color:var(--m-label-2)}
.m-gallery__title{margin:0;font:var(--m-type-large-title);color:var(--m-label)}
.m-gallery__lead{margin:0;font:var(--m-type-subhead);color:var(--m-label-2);max-width:60ch}
.m-gallery__section{display:grid;gap:var(--m-space-5);min-width:0}
.m-gallery__header{display:grid;gap:2px;padding-bottom:var(--m-space-2);border-bottom:.5px solid var(--m-separator)}
.m-gallery__heading{margin:0;font:var(--m-type-title);color:var(--m-label)}
.m-gallery__note{margin:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-gallery__group{display:grid;gap:var(--m-space-3);min-width:0}
.m-gallery__subheading{margin:0;font:var(--m-type-headline);color:var(--m-label)}
.m-gallery__specimen{margin:0;display:grid;gap:var(--m-space-2);justify-items:start;min-width:0}
.m-gallery__stage{display:flex;align-items:center;min-height:var(--m-control-large)}
.m-gallery__caption{font:var(--m-type-footnote);color:var(--m-label-2)}
@media (min-width:700px){.m-gallery{--m-page-inset:24px}}
@media (min-width:1100px){.m-gallery{--m-page-inset:32px}}
${tokensGalleryStyles}${buttonsGalleryStyles}${switchesGalleryStyles}${segmentedGalleryStyles}${steppersGalleryStyles}${listsGalleryStyles}${sheetsGalleryStyles}${skyGalleryStyles}${heroesGalleryStyles}${framesGalleryStyles}${widgetsGalleryStyles}${detailsGalleryStyles}`;

// The sections, in order: tokens, then each control, then the sheets, the
// sky, the heroes and the frames, then (#29 step 4) the widgets and parts,
// then (v32) the sheet parts and the 24-hour chart.
function Gallery() {
  return <main className="m-gallery" data-gallery-ready="true">
    <header className="m-gallery__intro">
      <p className="m-gallery__eyebrow">Maison · deterministic synthetic fixtures</p>
      <h1 className="m-gallery__title">Maison’s own controls</h1>
      <p className="m-gallery__lead">Every control in every state, on Maison’s tokens. Examples are drawn from the values the dashboard draws; presses act on nothing.</p>
    </header>
    <TokensSection/><ButtonsSection/><SwitchesSection/><SegmentedSection/><SteppersSection/><ListsSection/><SheetsSection/><SkySection/><HeroesSection/><FramesSection/><WidgetsSection/><DetailsSection/>
  </main>;
}

// `screen` is the served screen.js's screen(). The host carries `dark`
// for the dark theme, as the element does.
// `view: 'pages'` draws the pages view (gallery/pages.jsx) instead of the
// sections: every page whole in every frame size, then the sheets and the
// dialogs drawn in place.
export function mountGallery(target, {theme = 'light', screen, view = null} = {}) {
  if (!(target instanceof Element)) throw new TypeError('mountGallery requires a DOM element');
  if (typeof screen !== 'function') throw new TypeError('mountGallery requires screen.js\'s screen()');
  const host = document.createElement('section');
  host.setAttribute('aria-label', view === 'pages' ? 'Maison page gallery' : 'Maison component gallery');
  host.toggleAttribute('dark', theme === 'dark');
  const shadow = host.attachShadow({mode: 'open'});
  const style = document.createElement('style');
  style.textContent = `${appStyles}\n${galleryStyles}${view === 'pages' ? pagesGalleryStyles : ''}`;
  const rootElement = document.createElement('div');
  const portalElement = document.createElement('div');
  portalElement.dataset.galleryPortal = 'true';
  shadow.append(style, rootElement, portalElement);
  target.replaceChildren(host);
  const root = createRoot(rootElement);
  root.render(<UNSAFE_PortalProvider getContainer={() => portalElement}><PortalContext.Provider value={portalElement}><ScreenContext.Provider value={screen}>
    <CommandContext.Provider value={ignore}><NativeContext.Provider value={placeholderCard}>{view === 'pages' ? <PagesGallery/> : <Gallery/>}</NativeContext.Provider></CommandContext.Provider>
  </ScreenContext.Provider></PortalContext.Provider></UNSAFE_PortalProvider>);
  return {unmount: () => root.unmount()};
}
