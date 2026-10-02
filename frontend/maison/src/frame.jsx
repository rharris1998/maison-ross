// The frame around every page (#29), drawn from
// screen.js's chrome value (config/www/maison/screen.js chromeValue): the
// glass tab bar with the pages, the hero (hero.jsx: the sky, the header with
// the date, the large title, a line under it once the value gives one and
// the two tools, then the header chart), the connection banner and the
// action status line, then the page in a column capped at 1,120px. Under
// 700px of Maison's own width the tab bar floats at the foot of the screen,
// its tabs sharing its width and the current one on a glass capsule that
// slides from the old tab to the new (React Aria's SharedElement, as the
// segmented control's thumb); from 700px it is a pill that sticks at the top.
// Every word and accessible name comes from the value; the people and the
// footer are not drawn.
import {useRef} from 'react';
import {Button} from 'react-aria-components/Button';
import {SharedElement, SharedElementTransition} from 'react-aria-components/SharedElementTransition';
import {useCommand} from './contexts.js';
import {LayoutContext, useFrameLayout} from './ui/layout.js';
import {Glyph} from './ui/glyph.jsx';
import {Hero} from './hero.jsx';

// One page in the tab bar: its glyph above its label on a phone, beside it
// from 700px. The current page is marked for assistive technology and drawn
// in blue on the selection's thumb, which only the current tab holds; a
// press navigates.
function Tab({item: {link, label, icon, current}}) {
  const command = useCommand();
  return <Button className="m-tab m-focusable" aria-current={current ? 'page' : undefined} isDisabled={!link.enabled} onPress={() => command(link.intent)}>
    <SharedElement name="m-tab-thumb" isVisible={current} className="m-tab__thumb"/><Glyph name={icon}/><span className="m-tab__label">{label}</span>
  </Button>;
}

// While Home Assistant is unreachable: what is shown and what waits.
const Banner = ({value: {title, description}}) => <div className="m-banner" role="alert">
  <Glyph name="alert" className="m-banner__glyph"/>
  <div className="m-banner__copy"><p className="m-banner__title">{title}</p><p className="m-banner__text">{description}</p></div>
</div>;

/**
 * The frame around every page.
 *
 * DOM: `div.m-app[data-layout=phone|wide|desktop]`, measured by
 * useFrameLayout(). Inside, in this order:
 * - `nav.m-tabbar[aria-label=chrome.navLabel]`, first in the DOM, holding a
 *   React Aria `Button.m-tab.m-focusable` per page: `aria-current="page"` on
 *   the current one, which alone holds `div.m-tab__thumb` (a SharedElement
 *   in the nav's SharedElementTransition), then its Glyph then
 *   `span.m-tab__label`; a press sends `command(item.link.intent)`, and
 *   `!item.link.enabled` disables it. No tab is current on Home status, so
 *   there is no thumb.
 * - `div.m-hero` (hero.jsx's Hero, given the layout): the sky, then
 *   `div.m-header` (a div: a header element would be a banner landmark):
 *   `div.m-header__text` (`p.m-header__date`, `h1.m-header__title`, and
 *   `p.m-header__line` only while `chrome.line` is a non-empty string) and
 *   `div.m-header__tools` (44px glass icon-only IntentButtons for
 *   `chrome.alerts` and `chrome.status`, named by their ariaLabel), then the
 *   page's reading and header chart from `chrome.hero`.
 * - `div.m-banner[role=alert]` while `chrome.offline` is set.
 * - `div.m-status-region[role=status][aria-live=polite]`, always there so a
 *   screen reader hears the text that arrives in it, holding the
 *   `p.m-status` box only while `chrome.actionStatus` is non-empty.
 * - `div.m-content`, the page's column, holding `children` inside a
 *   LayoutContext provider (ui/layout.js) carrying the layout, which
 *   useLayout() reads.
 *
 * frame.css.js draws each layout. Nothing above the phone tab bar may create
 * a containing block (transform, filter, contain…), or the fixed bar would
 * follow it instead of the screen.
 *
 * @param {object} props
 * @param {object} props.chrome screen.js's Chrome value.
 * @param {import('react').ReactNode} props.children The page's <main>.
 */
export function Frame({chrome, children}) {
  const {navLabel, nav, offline, actionStatus} = chrome, ref = useRef(null), layout = useFrameLayout(ref);
  return <div className="m-app" data-layout={layout} ref={ref}>
    <nav className="m-tabbar" aria-label={navLabel}><SharedElementTransition>{nav.map(item => <Tab key={item.link.intent.entity} item={item}/>)}</SharedElementTransition></nav>
    <Hero chrome={chrome} layout={layout}/>
    {offline && <Banner value={offline}/>}
    <div className="m-status-region" role="status" aria-live="polite">{actionStatus && <p className="m-status">{actionStatus}</p>}</div>
    <div className="m-content"><LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider></div>
  </div>;
}
