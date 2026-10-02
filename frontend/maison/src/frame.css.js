// Maison's frame (#29): the host, the page column, the glass tab
// bar in its two placements, the banner, the status line and the toasts; the
// header is the hero's (hero.css.js). A layout follows `.m-app[data-layout]`,
// which useFrameLayout() sets from Maison's own width. From 700px the hero's
// sky reaches up behind the pill, which keeps the page's theme and paints
// above it (its z-index); the pill's height is set from the same reach, as
// a .5px border draws 1px on a 1x screen and would leave a line of page
// between them. Safe areas, the height of Home Assistant's fixed
// header and the width of its docked sidebar are read through Home
// Assistant's own variables (home-assistant-main sets --ha-sidebar-width to
// 56 or 256px plus the left safe area while the sidebar is docked, unsets it
// while it is a drawer, and --safe-area-content-inset-* to what the sidebar
// leaves uncovered), falling back to env() and to 0 outside it. So the phone
// tab bar, fixed to the screen, stays over Maison and off the sidebar.
//
// The host is a block at least the height of Home Assistant's view under
// its 56px header, Maison's page colour behind Maison's label colour, its
// text antialiased.
//
// Under everything sits Maison's base (v36), in a layer of its own,
// `m-base`: what of Tailwind's preflight (in HeroUI's sheet) and styles.js
// the pages, sheets and gallery were drawn and imaged on until then. Every
// element and pseudo-element starts with no margin, padding or border and
// sizes its border box; the host's text is the system stack at 14px/1.5
// (what a part without a type token inherits), never inflated or flashed
// grey on a phone, with 4-space tabs in a description; a button, an input
// or a select takes its text and colour from around it: the search field's
// clear button draws its glyph in the field's grey, and the input React
// Aria hides in each switch keeps its row's size, not the browser's
// 11-13px (each field Maison shows sets its own 17px); a
// date field's parts add no padding of their own, in Chromium the wrapper
// and in WebKit each field, the meridiem in a 12-hour locale; and figures
// in a b are tabular (the gallery's token values). Two guards move no pixel
// today and keep React Aria's unclassed parts as they were drawn: a control
// has no background of its own (the picker's hidden select, a sheet's
// hidden dismiss button), and a list no markers (the toasts' ol, hidden
// only by React Aria's display:contents). Any rule outside a layer beats
// every rule inside one, so a single-class .m- rule still wins over these,
// although the scoped reset is two classes heavier.
//
// The page (main.m-page) is at least 240px high, so the frame keeps its
// shape while a page has little to draw.
//
// Nothing here gives :host, .wrap, .m-app or .m-content a transform, filter,
// contain or the like: any of them would pin the phone tab bar to it instead
// of the screen. Only this file sets --m-type-caption (the tab labels).
//
// From 700px the pill sits over the sky, so its selected tab sits on an
// opaque white thumb, its label black and its glyph blue. A translucent chip
// with a blue label read at 1.2–1.5:1 over the sky (blue on blue), and
// #007AFF reaches only 4.0:1 even on white, so the label can't be blue and
// read at 4.5:1. In light the thumb is the segmented control's with the
// label colour (21:1); in dark that thumb is grey and reads as disabled on
// the blue glass, so there it is the switch's white thumb with the page's
// black as its label (21:1). Only a dark host swaps them, and the dark
// tokens always apply there, THEMED or not. The glyph is --m-blue, 4.0:1 in
// light and 3.7:1 in dark on white. The phone's bar floats over the page,
// never the sky, and keeps a glass capsule with a blue label, drawn as iOS
// draws its tab bar: the tabs share the bar's width, the capsule fills the
// current one's share 4px inside the bar (its 28px radius concentric with
// the bar's 32px) and slides to the next tab over --m-dur-control. From
// 700px the thumb doesn't slide: the pill's tabs differ in width, and a
// translate alone would carry the wrong width across.
const safe = side => `var(--safe-area-inset-${side},env(safe-area-inset-${side},0px))`;
// What the sidebar leaves of a side's safe area, beside it.
const content = side => `var(--safe-area-content-inset-${side},${safe(side)})`;
const sidebar = 'var(--ha-sidebar-width,0px)';
// The phone tab bar's lift off the bottom of the screen.
const lift = `max(var(--m-space-4),${safe('bottom')})`;

// The system stack Maison's text has inherited since HeroUI's theme set it,
// Apple's emoji fonts last.
const systemFont = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue","Noto Sans",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"';

export const frameStyles = `
@layer m-base{
:host *,:host ::before,:host ::after{box-sizing:border-box;border:0 solid;margin:0;padding:0}
:host{font-family:${systemFont};font-size:14px;line-height:1.5;-webkit-text-size-adjust:100%;text-size-adjust:100%;tab-size:4;-webkit-tap-highlight-color:transparent}
:host :is(button,input,select){font:inherit;color:inherit;background-color:transparent}
:host :is(ol,ul){list-style:none}
:host ::-webkit-datetime-edit{padding-block:0}
:host ::-webkit-datetime-edit-fields-wrapper{padding:0}
:host ::-webkit-datetime-edit-year-field{padding-block:0}
:host ::-webkit-datetime-edit-month-field{padding-block:0}
:host ::-webkit-datetime-edit-day-field{padding-block:0}
:host ::-webkit-datetime-edit-hour-field{padding-block:0}
:host ::-webkit-datetime-edit-minute-field{padding-block:0}
:host ::-webkit-datetime-edit-meridiem-field{padding-block:0}
:host b{font-variant-numeric:tabular-nums}
}
:host{display:block;min-height:calc(100dvh - 56px);background:var(--m-bg);color:var(--m-label);-webkit-font-smoothing:antialiased}
.m-app{box-sizing:border-box;padding:0 var(--m-page-inset) var(--m-space-8)}
.m-app[data-layout=phone]{--m-page-inset:16px;padding-bottom:calc(var(--m-tabbar-height) + 32px + ${safe('bottom')})}
.m-app[data-layout=wide]{--m-page-inset:24px}
.m-app[data-layout=desktop]{--m-page-inset:32px}
.m-app:not([data-layout=phone]){padding-top:var(--m-tabbar-top)}
.m-banner,.m-status,.m-content{box-sizing:border-box;max-width:var(--m-content-max);margin-inline:auto}
.m-content{min-width:0}
.m-page{min-height:240px}
.m-tabbar{box-sizing:border-box;display:flex;align-items:center;z-index:var(--m-z-tabbar);background:linear-gradient(180deg,var(--m-glass-top),var(--m-glass-bottom));-webkit-backdrop-filter:var(--m-glass-blur);backdrop-filter:var(--m-glass-blur);border:.5px solid var(--m-glass-border);box-shadow:var(--m-glass-highlight),var(--m-glass-shadow)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.m-tabbar{background:var(--m-glass-fallback)}}
.m-tab{position:relative;box-sizing:border-box;display:flex;align-items:center;justify-content:center;margin:0;border:0;background:transparent;color:var(--m-label);white-space:nowrap;cursor:pointer;user-select:none;-webkit-user-select:none;appearance:none;-webkit-appearance:none;touch-action:manipulation;transition:color var(--m-dur-control) var(--m-ease),transform var(--m-dur-press) var(--m-ease)}
.m-tab>.m-glyph,.m-tab__label{position:relative}
.m-tab__thumb{position:absolute;inset:0;border-radius:inherit;background:var(--m-glass-selected);transition:translate var(--m-dur-control) var(--m-ease)}
.m-tab[aria-current=page]{color:var(--m-blue-text)}
.m-tab[aria-current=page] .m-glyph{color:var(--m-blue)}
.m-app:not([data-layout=phone]) .m-tab__thumb{background:var(--m-segment-thumb);box-shadow:var(--m-segment-thumb-shadow);transition:none}
.m-app:not([data-layout=phone]) .m-tab[aria-current=page]{color:var(--m-label)}
:host([dark]) .m-app:not([data-layout=phone]) .m-tab__thumb{background:var(--m-switch-thumb);box-shadow:var(--m-switch-thumb-shadow)}
:host([dark]) .m-app:not([data-layout=phone]) .m-tab[aria-current=page]{color:var(--m-bg)}
.m-tab[data-pressed]{transform:scale(.92)}
.m-tab[data-disabled]{color:var(--m-label-3);cursor:default}
@media (prefers-reduced-motion:reduce){.m-tab[data-pressed]{transform:none;opacity:.6}}
.m-app[data-layout=phone] .m-tabbar{position:fixed;left:calc(${sidebar} + max(14px,${content('left')}));right:max(14px,${content('right')});bottom:${lift};max-width:480px;height:var(--m-tabbar-height);margin:0 auto;padding:4px;border-radius:32px;align-items:stretch}
.m-app[data-layout=phone] .m-tab{flex:1 1 0;flex-direction:column;gap:2px;min-width:0;padding:0 4px;border-radius:28px;font:var(--m-type-caption)}
.m-app[data-layout=phone] .m-tab .m-glyph{width:24px;height:24px}
.m-app[data-layout=phone] .m-tab__label{max-width:100%;overflow:hidden;text-overflow:ellipsis}
.m-app:not([data-layout=phone]) .m-tabbar{position:sticky;top:calc(var(--header-height,0px) + ${safe('top')} + var(--m-tabbar-top));width:max-content;max-width:100%;height:calc(var(--m-tabbar-reach) - var(--m-tabbar-top));margin:0 auto;padding:5px;gap:4px;border-radius:26px}
.m-app:not([data-layout=phone]) .m-tab{height:var(--m-tab-top-height);gap:7px;padding:0 16px;border-radius:19px;font:var(--m-type-subhead-strong)}
.m-app:not([data-layout=phone]) .m-tab .m-glyph{width:17px;height:17px}
.m-app:not([data-layout=phone]) .m-tab::after{content:"";position:absolute;inset:-5px 0}
.m-banner{display:flex;align-items:flex-start;gap:var(--m-space-3);margin-bottom:var(--m-space-4);padding:14px var(--m-card-padding);border-radius:var(--m-radius-card);background:var(--m-orange-fill)}
.m-banner__glyph{width:22px;height:22px;color:var(--m-orange)}
.m-banner__copy{display:grid;gap:2px;min-width:0}
.m-banner__title{margin:0;font:var(--m-type-headline);color:var(--m-label)}
.m-banner__text{margin:0;font:var(--m-type-subhead);color:var(--m-label-2)}
.m-status{margin-top:0;margin-bottom:var(--m-space-4);padding:10px var(--m-space-5);border-radius:var(--m-radius-capsule);background:var(--m-fill-gray);font:var(--m-type-subhead);color:var(--m-label);overflow-wrap:anywhere}
.m-toasts{z-index:var(--m-z-toast);bottom:${lift};margin-inline-start:calc(${sidebar} / 2)}
:host .wrap:has(>.m-app[data-layout=phone])~.maison-overlays .m-toasts{bottom:calc(${lift} + var(--m-tabbar-height) + var(--m-space-3))}
`;
