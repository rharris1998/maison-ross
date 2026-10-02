// The states every Maison control shares (#29): the keyboard focus ring,
// no grey tap flash on a phone, a 44px hit area around a 36px control, and
// the glyph box every icon sits in. React Aria sets data-focus-visible only
// for keyboard focus, so a tap never draws the ring. `.m-visually-hidden`
// (step 4, the same rule as a pending button's progress bar) keeps text for
// assistive technology only: a chart's description, a hidden label.
export const baseStyles = `
.m-focusable{outline:none}
.m-focusable[data-focus-visible]{outline:2px solid var(--m-focus-ring);outline-offset:2px}
.m-focusable,.m-button,.m-switch,.m-segmented__item,.m-row--pressable,.m-tab{-webkit-tap-highlight-color:transparent}
.m-hit{position:relative}
.m-hit::after{content:"";position:absolute;inset:-4px}
.m-glyph{display:inline-grid;place-items:center;line-height:0;width:1em;height:1em;flex:none}
.m-glyph svg{width:100%;height:100%}
.m-visually-hidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
`;
