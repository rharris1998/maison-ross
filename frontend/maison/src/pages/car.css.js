// The Car (#29 step 4, v34): only what is the Car's own,
// the page's rhythm under the hero and the widget bodies' inner layout. The
// widgets and the parts bring their own surfaces, type and tones.
//
// Rhythm: the page's blocks stand 24px apart, as Energy's do. The page's
// block is `m-car-page`: `m-car` is the hero chart's (charts/car.css.js).
//
// Phone. The battery's ring (136px) sits 16px from its copy, centred on
// it: the line in subhead, then the tick legend and the freshness in
// footnote, 4px apart. A tick's swatch is the Ring's own tick, 3 × 10px
// with round ends, in its colour: the reserve --m-gray, the limit
// --m-label; the legend's items are spaced as the Legend part's are, and
// each keeps its words together. Where the card leaves the copy less than
// 128px beside the ring (a 320px phone), the copy drops under the ring
// rather than wrap word by word, and the ring stands centred over it
// (beside the ring the copy grows to fill the line, so nothing moves). Charging stacks its controls 12px apart on
// its card: the 44px button the card's width, the limit's row with its
// stepper at the end, Wake's row (both titled in headline, as a setting
// is, and wrapping without leaving a word alone on their last line), the quiet line (the QuietLine part, its
// glyph at the card's edge rather than a section title's 4px in, and its
// words wrapping beside it: it holds no buttons to wrap), then the
// feedback lines 2px apart. Where the limit's words would have less than 112px beside the
// stepper (a 320px phone), the stepper wraps under them at the row's end,
// as Climate's sheets do, rather than 'Charge limit' breaking; Wake's
// button does the same where its words would have less than 144px beside
// it (under about 360px), so the title and detail keep whole lines. The charging
// energy's figure sits over its bar (12px) and the legend (10px under it).
// Automatic charging is one inset row with no widget round it, as Energy's
// money list, its feedback 8px under the card, lined up with the row's
// words. Its note ('Unavailable', one word) never breaks: it takes its own
// width, past the list's third of the row, and the row's words wrap.
//
// From 700px every body fits its rows with nothing clipped: 107px in a
// medium widget (106px where Chromium draws the border whole), 291px in
// the large one.
// - Battery (medium): the small ring (80px) beside the copy, centred in the
//   body: the line at most two lines, the legend and the freshness one each:
//   40 + 4 + 18 + 4 + 18 = 84px. Large (desktop only: at wide, where a
//   medium fills its row alone, the page draws it medium): the regular ring
//   (136px) over the copy, centred as a column in the body, the copy raised
//   so it holds the space (the line in headline, the legend and freshness
//   in subhead, the ticks' swatches 12px to match), the line as long as it
//   is: 136 + 16 + 44 + 4 + 20 + 4 + 20 = 244px with a two-line line.
// - Charging (medium): the controls 8px apart from the top, the button at
//   its own width, the rows 40px at least (the stepper and the Wake button
//   are 36px, and their 44px hit areas clear the button's in the gap):
//   36 + 8 + 46 = 90px with the limit's detail. The feedback takes the room
//   left at the foot, 4px under the rows, a line each, cut short, and what
//   doesn't fit is clipped; while a button stands over a row, the row gives
//   up its detail for the first line (car.jsx):
//   36 + 8 + 40 + 4 + 18 = 106px. Without a button, two lines fit whole.
//   A single row or line (no button, no feedback: at the limit, asleep,
//   reconnecting) is centred in the body, as Battery's ring is.
// - Charging energy (medium): as Energy's today, the figure at the top (its
//   label beside it), the bar and its legend at the foot:
//   48 + 12 + 10 + 10 + 18 = 98px.
// - Automatic charging (medium): its one 52px row, then its feedback 4px
//   under it, centred in the body.
export const carPageStyles = `
.m-car-page{display:flex;flex-direction:column;gap:var(--m-space-6);min-width:0}
.m-car-page__battery{flex:1;display:flex;align-items:center;gap:var(--m-space-4);min-width:0;min-height:0}
.m-car-page__battery>.m-ring{flex:none;max-width:100%}
.m-car-page__copy{flex:1 1 128px;display:flex;flex-direction:column;gap:var(--m-space-1);min-width:0}
.m-widget--phone .m-car-page__battery{flex-wrap:wrap;justify-content:center;row-gap:var(--m-space-3)}
.m-widget--large .m-car-page__battery{flex-direction:column;justify-content:center}
.m-widget--large .m-car-page__copy{flex:none;align-items:center;max-width:100%;text-align:center}
.m-car-page__line{margin:0;min-width:0;font:var(--m-type-subhead);color:var(--m-label);overflow-wrap:anywhere;text-wrap:pretty}
.m-widget--medium .m-car-page__line{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.m-car-page__legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2)}
.m-widget--large .m-car-page__legend{justify-content:center}
.m-widget--large .m-car-page__line{font:var(--m-type-headline)}
.m-widget--large :is(.m-car-page__legend,.m-car-page__freshness){font:var(--m-type-subhead)}
.m-widget--large .m-car-page__tick{height:12px}
.m-car-page__legend-item{display:inline-flex;align-items:center;gap:6px;min-width:0;white-space:nowrap}
.m-car-page__tick{flex:none;width:3px;height:10px;border-radius:1.5px}
.m-car-page__tick--reserve{background:var(--m-gray)}
.m-car-page__tick--limit{background:var(--m-label)}
.m-car-page__freshness{margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
.m-widget:not(.m-widget--phone) .m-car-page__freshness{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-car-page__charge{flex:1;display:flex;flex-direction:column;gap:var(--m-space-3);min-width:0;min-height:0}
.m-car-page__charge .m-row__title{text-wrap:pretty}
.m-widget--phone .m-car-page__charge .m-row:has(>.m-row__accessory>.m-stepper){flex-wrap:wrap;row-gap:var(--m-space-2)}
.m-widget--phone .m-car-page__charge .m-row:has(>.m-row__accessory>.m-stepper)>.m-row__copy{flex:1 1 112px;min-width:min-content}
.m-widget--phone .m-car-page__charge .m-row:has(>.m-row__accessory>.m-stepper) :is(.m-row__title,.m-row__detail){overflow-wrap:break-word}
.m-widget--phone .m-car-page__charge .m-row:has(>.m-row__accessory>.m-stepper)>.m-row__accessory{margin-inline-start:auto}
.m-widget--phone .m-car-page__charge .m-row:has(>.m-row__accessory>.m-button){flex-wrap:wrap;row-gap:var(--m-space-2)}
.m-widget--phone .m-car-page__charge .m-row:has(>.m-row__accessory>.m-button)>.m-row__copy{flex:1 1 144px;min-width:min-content}
.m-widget--phone .m-car-page__charge .m-row:has(>.m-row__accessory>.m-button) :is(.m-row__title,.m-row__detail){overflow-wrap:break-word}
.m-widget--phone .m-car-page__charge .m-row:has(>.m-row__accessory>.m-button)>.m-row__accessory{margin-inline-start:auto}
.m-widget:not(.m-widget--phone) .m-car-page__charge{gap:var(--m-space-2)}
.m-widget:not(.m-widget--phone) .m-car-page__charge>.m-button{flex:none;align-self:flex-start;max-width:100%}
.m-widget:not(.m-widget--phone) .m-car-page__charge .m-row{min-height:40px;padding-block:2px}
.m-car-page__charge>.m-quiet{flex-wrap:nowrap;padding-inline:calc(17px + var(--m-space-2)) 0}
.m-widget:not(.m-widget--phone) .m-car-page__charge--single{justify-content:center}
.m-car-page__feedback{display:flex;flex-direction:column;gap:2px;min-width:0}
.m-widget:not(.m-widget--phone) .m-car-page__feedback{flex:1 1 0;min-height:0;margin-top:calc(-1 * var(--m-space-1));overflow:hidden}
.m-widget:not(.m-widget--phone) .m-car-page__feedback>.m-feedback{flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-car-page__automatic{display:flex;flex-direction:column;gap:var(--m-space-2);min-width:0}
.m-car-page__automatic .m-row__value{flex:none;max-width:none;white-space:nowrap}
.m-car-page__automatic>.m-list--inset+.m-feedback{padding-inline:var(--m-space-4)}
.m-widget:not(.m-widget--phone) .m-car-page__automatic{flex:1;justify-content:center;gap:var(--m-space-1);min-height:0}
.m-car-page__energy{flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:var(--m-space-3);min-width:0;min-height:0}
.m-car-page__split{display:flex;flex-direction:column;gap:10px;min-width:0}
`;
