// The frames section of the gallery (#29): every page drawn inside the
// new frame, under its hero (the sky, the header and the header chart), from
// the values the dashboard draws for the gallery's fixtures, and one frame
// offline with an action on its way. Each frame sits in a cropped window
// whose layout containment makes it the containing block of the phone's
// fixed tab bar, so the bar floats at the window's foot rather than the
// gallery's; the page scrolls inside the window, where the wide and desktop
// pills stick at its top, over the sky. Phone windows are 390px wide
// (narrower on a phone); from a 1,240px gallery a wide (900px) window and two
// desktop (1,180px) ones follow, Today and Energy, whose price shows only
// there. Presses act on nothing (the gallery's command is `ignore`).
import {HOME_NOW} from '../../fixtures/home-fixtures.js';
import {HOME, PENDING, heroSnapshot, pageSnapshot, skySnapshot, useScreen} from '../gallery-snapshots.js';
import {PAGES} from '../pages.jsx';
import {Frame} from '../frame.jsx';
import {GalleryGroup, GallerySection} from './section.jsx';

// A page fixture with a sky fixture's sun and weather laid over its states,
// at the page's own time: for the pages whose hero is the sky alone.
const underSky = (snapshot, sky) => ({...snapshot, states: {...snapshot.states, ...skySnapshot(sky).states}});

// Each page's snapshot: the four heroes' variants (gallery-snapshots.js
// heroSnapshot), and Home status under a sky of its own.
const SNAPSHOTS = {
  today: () => heroSnapshot('today', 'day'),
  climate: () => heroSnapshot('climate', 'running'),
  car: () => heroSnapshot('car', 'solar'),
  energy: () => heroSnapshot('energy', 'solar-charging'),
  system: () => underSky(pageSnapshot(HOME, 'system', HOME_NOW, {query: '', category: 'all', limit: 8}), 'dusk'),
};
const CAPTIONS = {today: 'Today, midday sun', climate: 'Climate, a cloudy afternoon', car: 'Car, charging from solar', energy: 'Energy, solar charging the Car',
  system: 'Home status, at dusk'};
// Home Assistant unreachable while the Bedroom radiator's request waits.
const offline = () => ({...heroSnapshot('climate', 'running'), online: false, status: PENDING.feedback[0][1]});

// One page in its frame, in a cropped window: `size` is phone, wide or desktop.
function Window({id, size, snapshot = SNAPSHOTS[id](), caption = CAPTIONS[id]}) {
  const {chrome, page} = useScreen()(snapshot), Page = PAGES[page.id];
  return <figure className="m-gallery-window">
    <div className={`m-gallery-frame m-gallery-frame--${size}`} data-gallery-frame={`${size}-${id}`}><div className="m-gallery-frame__scroll">
      <Frame chrome={chrome}><main className="m-page"><Page value={page}/></main></Frame>
    </div></div>
    <figcaption className="m-gallery__caption">{caption}</figcaption>
  </figure>;
}

export function FramesSection() {
  return <GallerySection name="frames" title="Frames" note="Each page in the new frame under its sky, cropped: a floating tab bar on a phone, a pill that sticks at the top from 700 px">
    <GalleryGroup title="Phone">
      <div className="m-gallery-windows">
        {Object.keys(SNAPSHOTS).map(id => <Window key={id} id={id} size="phone"/>)}
        <Window id="offline" size="phone" snapshot={offline()} caption="Climate, offline, with an action waiting"/>
      </div>
    </GalleryGroup>
    <div className="m-gallery-windows-large">
      <GalleryGroup title="Wide"><Window id="climate" size="wide"/></GalleryGroup>
      <GalleryGroup title="Desktop"><Window id="today" size="desktop"/><Window id="energy" size="desktop"/></GalleryGroup>
    </div>
  </GallerySection>;
}

// The windows: phone ones side by side, the large ones only where the
// gallery is wide enough to hold a desktop frame, which reaches out of the
// gallery's column to be wider than 1,100px. WebKit paints only the
// background of a fixed element whose containing block comes from
// `contain`, not its tabs; a compositing layer of its own for the phone bar
// makes it paint them. The dashboard has no such ancestor, so it needs none.
export const framesGalleryStyles = `
.m-gallery-windows{display:flex;flex-wrap:wrap;gap:var(--m-space-6) var(--m-space-5);align-items:flex-start}
.m-gallery-window{margin:0;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-2);min-width:0}
.m-gallery-windows .m-gallery-window{width:min(100%,390px)}
.m-gallery-frame{position:relative;contain:layout paint;box-sizing:border-box;height:560px;overflow:hidden;border:.5px solid var(--m-separator);border-radius:var(--m-radius-screen);background:var(--m-bg)}
.m-gallery-frame__scroll{height:100%;overflow-x:hidden;overflow-y:auto;scrollbar-width:none}
.m-gallery-frame__scroll::-webkit-scrollbar{display:none}
.m-gallery-frame .m-app[data-layout=phone] .m-tabbar{transform:translateZ(0)}
.m-gallery-frame--wide{width:900px;height:520px;border-radius:var(--m-radius-card)}
.m-gallery-frame--desktop{width:1180px;height:600px;margin-inline-start:calc(50% - 590px);border-radius:var(--m-radius-card)}
.m-gallery-windows-large{display:none}
@media (min-width:1240px){.m-gallery-windows-large{display:grid;gap:var(--m-space-6)}}
`;
