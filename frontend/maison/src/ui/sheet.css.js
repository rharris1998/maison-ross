// The sheet (#29), as iOS draws one: a scrim over the page, and a rounded
// card floating 8px off the phone's edges (a form sheet in the centre from
// 700px), with a grabber, a header and a body that scrolls on its own. The
// header is a grid, so the glass close button sits centred on the title's
// first line whether or not there is an eyebrow above it. The
// overlay is sized to the visual viewport React Aria measures, so a bottom
// sheet sits above the iPhone keyboard; no height here uses vh. Transforms
// go on .m-sheet only: it rises from below (or grows in the centre) over
// --m-dur-sheet, which reduced motion makes 0ms, and a swipe moves it.
// Safe areas read Home Assistant's variables first, as the frame does. The
// body's text is Maison's label colour, whatever a body sets for itself.
const safe = side => `var(--safe-area-inset-${side},env(safe-area-inset-${side},0px))`;
export const sheetStyles = `
.m-sheet-overlay{position:fixed;top:0;left:0;z-index:var(--m-z-sheet);box-sizing:border-box;width:100%;height:var(--visual-viewport-height,100dvh);display:grid;place-items:center;background:var(--m-scrim);-webkit-tap-highlight-color:transparent}
.m-sheet-overlay[data-entering]{animation:m-sheet-scrim-in var(--m-dur-sheet) var(--m-ease)}
.m-sheet-overlay[data-exiting]{animation:m-sheet-scrim-out var(--m-dur-sheet) var(--m-ease) forwards}
.m-sheet{position:relative;box-sizing:border-box;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:var(--m-sheet-fill);border-radius:var(--m-radius-sheet);box-shadow:var(--m-glass-shadow);color:var(--m-label);outline:none}
.m-sheet[data-placement=bottom]{position:absolute;left:8px;right:8px;bottom:8px;max-height:calc(var(--visual-viewport-height,100dvh) - max(${safe('top')},20px) - 16px)}
.m-sheet[data-placement=center]{width:min(640px,100% - 48px);max-height:min(88dvh,var(--visual-viewport-height,100dvh) - 48px)}
.m-sheet[data-placement=bottom][data-entering]{animation:m-sheet-rise var(--m-dur-sheet) var(--m-ease)}
.m-sheet[data-placement=bottom][data-exiting]{animation:m-sheet-sink var(--m-dur-sheet) var(--m-ease) forwards}
.m-sheet[data-placement=center][data-entering]{animation:m-sheet-grow var(--m-dur-sheet) var(--m-ease)}
.m-sheet[data-placement=center][data-exiting]{animation:m-sheet-shrink var(--m-dur-sheet) var(--m-ease) forwards}
.m-sheet__dialog{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;outline:none}
.m-sheet__grabber{flex:none;box-sizing:border-box;height:16px;padding-top:5px;display:flex;justify-content:center;touch-action:none;cursor:grab}
.m-sheet__grabber::before{content:"";width:36px;height:5px;border-radius:var(--m-radius-capsule);background:var(--m-label-3)}
.m-sheet__header{flex:none;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;column-gap:var(--m-space-3);padding:6px var(--m-space-4) var(--m-space-3);touch-action:none;user-select:none;-webkit-user-select:none}
.m-sheet[data-placement=bottom] .m-sheet__header{cursor:grab}
.m-sheet[data-placement=center] .m-sheet__header{padding:var(--m-space-5) var(--m-space-5) var(--m-space-3) var(--m-space-6)}
.m-sheet__heading{display:contents}
.m-sheet__eyebrow{grid-area:1/1;margin:0 0 2px;font:var(--m-type-footnote-strong);color:var(--m-label-2)}
.m-sheet__title{grid-area:2/1;margin:0;font:var(--m-type-title);color:var(--m-label);overflow-wrap:anywhere}
.m-sheet__close{grid-area:2/2;margin-block:-4px;box-shadow:var(--m-glass-highlight),var(--m-glass-shadow-small)}
.m-sheet__close .m-glyph{width:15px;height:15px}
.m-sheet__body{flex:1 1 auto;min-height:0;box-sizing:border-box;display:grid;align-content:start;gap:20px;padding:var(--m-space-1) var(--m-space-4) max(20px,${safe('bottom')});overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;color:var(--m-label)}
.m-sheet[data-placement=center] .m-sheet__body{padding:var(--m-space-1) var(--m-space-6) var(--m-space-6)}
.m-sheet__body>*{min-width:0}
@keyframes m-sheet-scrim-in{from{background-color:transparent}}
@keyframes m-sheet-scrim-out{to{background-color:transparent}}
@keyframes m-sheet-rise{from{transform:translateY(calc(100% + 8px))}}
@keyframes m-sheet-sink{to{transform:translateY(calc(100% + 8px))}}
@keyframes m-sheet-grow{from{opacity:0;transform:scale(.96)}}
@keyframes m-sheet-shrink{to{opacity:0;transform:scale(.96)}}
`;
