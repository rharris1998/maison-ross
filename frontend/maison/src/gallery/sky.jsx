// The sky section of the gallery (#29 step 3): every sky fixture as a
// strip, drawn as the dashboard draws it: the served screen.js's sky value
// for the fixture's states (sky.js), painted by sky-model.js and drawn by
// Sky. Each strip is captioned with the fixture's title and id.
import {SKY_FIXTURES} from '../../fixtures/sky-fixtures.js';
import {skySnapshot, useScreen} from '../gallery-snapshots.js';
import {skyPaint} from '../sky-model.js';
import {Sky} from '../sky.jsx';
import {GallerySection} from './section.jsx';

// One sky fixture as a strip, with its phase for the visual tests.
function Strip({fixture: {id, title}}) {
  const paint = skyPaint(useScreen()(skySnapshot(id)).chrome.sky);
  return <figure className="m-gallery-sky" data-gallery-sky={id}>
    <div className="m-gallery-sky__strip" data-sky={paint.phase}><Sky paint={paint}/></div>
    <figcaption className="m-gallery__caption">{title} · {id}</figcaption>
  </figure>;
}

export function SkySection() {
  return <GallerySection name="sky" title="Sky" note="The living sky from the sun and the weather, the same in both themes">
    <div className="m-gallery-skies">{SKY_FIXTURES.map(fixture => <Strip key={fixture.id} fixture={fixture}/>)}</div>
  </GallerySection>;
}

// The strips in a grid, each a thumbnail of a hero's sky: 120px tall and
// clipping its own sky, its fade band shortened to suit, its caption under
// it on the page.
export const skyGalleryStyles = `
.m-gallery-skies{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:var(--m-space-5) var(--m-space-4)}
.m-gallery-sky{margin:0;display:grid;gap:var(--m-space-2);min-width:0}
.m-gallery-sky__strip{--m-sky-fade:24px;position:relative;height:120px;overflow:hidden;border-radius:var(--m-radius-card) var(--m-radius-card) 0 0}
`;
