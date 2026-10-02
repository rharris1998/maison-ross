// The disclosure (#29 step 4), as iOS draws a collapsible section's header:
// the title in headline, as a sheet's section headings are, with a chevron
// at the far end in --m-blue-text, since the heading presses, turning from
// › to ⌄ over --m-dur-control while open (at once under reduced motion,
// where the token is 0ms). The trigger is the heading's whole width and at
// least 44px tall; a press fades it as a plain button's does, and the
// keyboard ring follows its rounded corners 2px out. The panel sits under
// it; what goes in it brings its own spacing, with --m-space-1 over it
// while open so its first line clears the trigger's box. Closed, React Aria
// hides it with hidden="until-found", which in a browser keeps its box
// (content-visibility, not display), so the closed panel has no padding
// and adds nothing under the trigger; nothing here sets its display.
export const disclosureStyles = `
.m-disclosure{min-width:0}
.m-disclosure__heading{margin:0;min-width:0;font:var(--m-type-headline)}
.m-disclosure__trigger{position:relative;box-sizing:border-box;display:flex;align-items:center;gap:var(--m-space-2);width:100%;min-height:var(--m-hit);margin:0;padding:0;border:0;border-radius:var(--m-radius-tile);background:transparent;color:var(--m-label);font:var(--m-type-headline);text-align:left;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;appearance:none;-webkit-appearance:none;transition:opacity var(--m-dur-press) var(--m-ease)}
.m-disclosure__trigger[data-pressed]{opacity:.55;transition-duration:0ms}
.m-disclosure__title{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.m-disclosure__chevron{flex:none;width:15px;height:15px;color:var(--m-blue-text);transition:rotate var(--m-dur-control) var(--m-ease)}
.m-disclosure[data-expanded] .m-disclosure__chevron{rotate:90deg}
.m-disclosure__panel{min-width:0}
.m-disclosure[data-expanded]>.m-disclosure__panel{padding-top:var(--m-space-1)}
`;
