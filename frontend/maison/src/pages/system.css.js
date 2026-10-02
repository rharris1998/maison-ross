// Home status (#29 step 4, v35): the page's sections as
// iOS grouped lists: each its section title (SectionTitle, the 22px title
// every page's sections have, its own top margin dropped) over its inset
// list, a footnote caption under it, 8px apart, the sections 24px apart
// under the hero. Titles, captions and the summary sit 4px in from the
// cards' edge, as a page's section titles do. The lists, the chip, the
// field and the picker bring their own surfaces, type and tones.
//
// Phone (the frame's layout, as the page's class says): one column. The
// checks' box gives way (display: contents), so its sections and All
// sensors' box are the column's items, and Home Assistant (order 1) moves
// after All sensors: Needs attention, Key devices, Vacuum maintenance, All
// sensors, Home Assistant, from one DOM at every width. Home Assistant is
// never a scroll anchor: it comes before All sensors in the DOM but is drawn
// after it, so Chromium, anchoring to it, would follow it down past the 60
// readings Show more adds, rather than leave them under the reader's eye.
//
// From 700px: two equal columns inside the frame's 1,120px, the widget
// grid's gap between them, so their edges line up with the other pages'
// widgets; the checks on the left, All sensors on the right, each as tall
// as its sections. The checks' column is sticky 16px under the tab bar's
// pill (Home Assistant's header, the top safe area and the pill's reach, as
// frame.css.js places the pill), so it stays in view while the long list
// scrolls; the page's ancestors clip nothing, so the frame's scroll
// container (Home Assistant's view, or the document) lets it stick, and it
// stops at the end of the page's grid. While it is taller than that
// container leaves it (`--tall`, measured by system.jsx against the
// container that actually scrolls), it scrolls with the page instead, so
// its foot is never hidden until the sensors end. Sticky creates no
// containing block for the phone's fixed tab bar, and the phone never
// sticks.
//
// All sensors: the count's chip sits beside the heading, centred on it.
// The search field fills the line; the picker and the summary share the
// next one, the summary in a footnote after the capsule while all of it
// fits beside it, and otherwise whole on the line under it (a phone's).
// Show more is the list's last row, bare, with no chevron, its words in
// --m-blue-text: it acts rather than opening a reading, as iOS draws an
// action in a list. A row's title or detail breaks inside a word only when
// the word can't fit a line of its own (a long name on a 320px phone), and
// leaves no word alone on its last line.
//
// A row's value never breaks: it keeps one line, up to 45% of the row
// (list.css.js caps it at a third and lets it break anywhere, which split a
// reading such as '3,326,662,592' in two), and what doesn't fit is cut
// short with an ellipsis, as iOS cuts a cell's detail. Home Assistant's
// titles are short and known, so there the value may take 60% and the
// title keeps its longest word whole: 'Core updates' wraps between its
// words before '2026.10.0 available' is cut, which it isn't from 375px.
const safeTop = 'var(--safe-area-inset-top,env(safe-area-inset-top,0px))';

export const systemPageStyles = `
.m-system-page{display:flex;flex-direction:column;gap:var(--m-space-6);min-width:0}
.m-system-page--phone>.m-system-page__checks{display:contents}
.m-system-page--phone .m-system-page__section--home-assistant{order:1;overflow-anchor:none}
.m-system-page:not(.m-system-page--phone){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;column-gap:var(--m-widget-gap)}
.m-system-page__checks,.m-system-page__sensors{display:flex;flex-direction:column;gap:var(--m-space-6);min-width:0}
.m-system-page:not(.m-system-page--phone)>.m-system-page__checks{position:sticky;top:calc(var(--header-height,0px) + ${safeTop} + var(--m-tabbar-reach) + var(--m-space-4))}
.m-system-page:not(.m-system-page--phone)>.m-system-page__checks.m-system-page__checks--tall{position:static}
.m-system-page__section{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--m-space-2);min-width:0}
.m-system-page__head{display:flex;align-items:center;gap:var(--m-space-2);min-width:0;padding-inline:var(--m-space-1)}
.m-system-page__head>.m-section-title{flex:0 1 auto;margin:0;min-width:0;overflow-wrap:anywhere}
.m-system-page__footer{margin:0;padding-inline:var(--m-space-1);min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere;text-wrap:pretty}
.m-system-page__filter{display:flex;flex-wrap:wrap;align-items:center;gap:var(--m-space-2) var(--m-space-3);min-width:0}
.m-system-page__summary{flex:1 1 auto;margin:0;padding-inline:var(--m-space-1);min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
.m-system-page :is(.m-row__title,.m-row__detail){overflow-wrap:break-word;text-wrap:pretty}
.m-system-page .m-row__value{max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-system-page__section--home-assistant .m-row__copy{min-width:min-content}
.m-system-page .m-system-page__section--home-assistant .m-row__value{max-width:60%}
.m-system-page__readings .m-row--bare.m-row--pressable .m-row__title{color:var(--m-blue-text)}
.m-system-page__readings .m-row--bare.m-row--pressable[data-disabled] .m-row__title{color:var(--m-label-3)}
`;
