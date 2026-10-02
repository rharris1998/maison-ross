// Maison's toast (#29 step 4, v35): a glass capsule, the tab bar's
// material, with a line of subhead and a gray close button, as iOS draws a
// passing note. The region is fixed at the bottom centre of the screen
// (centred by its own half width, so the frame's margin can move it off
// Home Assistant's sidebar) and lets presses through between its toasts;
// how far above the bottom it sits is the frame's (.m-toasts in
// frame.css.js: above the phone tab bar, its lift elsewhere). The
// newest toast is nearest the bottom. A long note wraps inside the toast,
// which is at most 480px wide and keeps 16px off the screen's sides; its
// height grows from the close button's 36px plus 4px round it (44px). It
// rises in over --m-dur-sheet, which reduced motion makes 0ms; React Aria
// removes it at once when it closes. Without backdrop-filter the glass
// takes the tab bar's opaque fallback. While a sheet makes the region
// inert (a toast already showing when it opened), the region is hidden, so
// it neither covers the sheet nor lets a tap through to it; a toast that
// outlives the sheet comes back.
export const toastStyles = `
.m-toast-region{position:fixed;left:50%;bottom:var(--m-space-4);z-index:var(--m-z-toast);box-sizing:border-box;display:flex;flex-direction:column-reverse;align-items:center;gap:var(--m-space-2);width:max-content;max-width:min(480px,100vw - 2 * var(--m-space-4));translate:-50% 0;outline:none;pointer-events:none}
.m-toast-region[inert]{visibility:hidden}
.m-toast{box-sizing:border-box;display:flex;align-items:center;gap:var(--m-space-2);max-width:100%;min-height:var(--m-hit);padding:var(--m-space-1) var(--m-space-1) var(--m-space-1) var(--m-space-4);border:.5px solid var(--m-glass-border);border-radius:var(--m-radius-card);background:linear-gradient(180deg,var(--m-glass-top),var(--m-glass-bottom));-webkit-backdrop-filter:var(--m-glass-blur);backdrop-filter:var(--m-glass-blur);box-shadow:var(--m-glass-highlight),var(--m-glass-shadow);color:var(--m-label);outline:none;pointer-events:auto;animation:m-toast-rise var(--m-dur-sheet) var(--m-ease)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.m-toast{background:var(--m-glass-fallback)}}
.m-toast__content{flex:1 1 auto;min-width:0;padding-block:var(--m-space-2)}
.m-toast__title{display:block;font:var(--m-type-subhead);color:var(--m-label);overflow-wrap:anywhere}
.m-toast__close{flex:none}
.m-toast__close .m-glyph{width:15px;height:15px}
@keyframes m-toast-rise{from{opacity:0;translate:0 12px}}
`;
