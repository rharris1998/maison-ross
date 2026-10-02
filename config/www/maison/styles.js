// The element's shell (ADR 0005): what Maison draws before its React bundle
// has loaded, the loading line or the notice with Retry, in Maison's own
// look. Maison's tokens arrive with the bundle, so the shell writes their
// values out (frontend/maison/src/ui/tokens.js): the page and card colours,
// the labels, the fills and the orange, and the system font. Never Home
// Assistant's theme variables: the shell looks like the page that replaces
// it, with no jump at mount, and a theme's colours never land on Maison's
// page. The host follows Home Assistant's light or dark mode through its
// `dark` attribute. Every rule sits in one layer, so any rule the bundle
// brings beats it, whatever its selector, and the host sets nothing that
// inherits: once React mounts, the pages take their type and colours from
// the bundle alone. The line and the notice sit where the page's content
// will, inset 16, 24 or 32px by the layout's widths, at most 1120px wide;
// the host is a flow root so their top margin stays inside it (the bundle's
// frame makes it a block again). The notice is a one-row inset list: a
// row's height, padding and tile, on a card's 24px corners.
const font = 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
export const styles = `
@layer maison-shell{
:host{display:flow-root;min-height:calc(100dvh - 56px);background:#F2F2F7}
:host([dark]){background:#000000}
.m-loading,.m-notice{--shell-label:#000000;--shell-label-2:rgba(60,60,67,.75);--shell-card:#FFFFFF;--shell-fill:rgba(120,120,128,.12);--shell-fill-pressed:rgba(120,120,128,.20);--shell-orange:#C93400;--shell-orange-fill:rgba(255,149,0,.2)}
:host([dark]) .m-loading,:host([dark]) .m-notice{--shell-label:#FFFFFF;--shell-label-2:rgba(235,235,245,.62);--shell-card:#1C1C1E;--shell-fill:rgba(255,255,255,.13);--shell-fill-pressed:rgba(255,255,255,.20);--shell-orange:#FF9F0A;--shell-orange-fill:rgba(255,159,10,.2)}
.m-loading,.m-notice{box-sizing:border-box;max-width:1120px;margin:24px 16px 0;-webkit-font-smoothing:antialiased}
@media (min-width:700px){.m-loading,.m-notice{margin-inline:24px}}
@media (min-width:1100px){.m-loading,.m-notice{margin-inline:max(32px,calc(50% - 560px))}}
.m-loading{font:400 17px/22px ${font};color:var(--shell-label-2)}
.m-notice{display:flex;align-items:center;gap:12px;min-height:58px;padding:11px 16px;border-radius:24px;background:var(--shell-card);color:var(--shell-label)}
.m-notice__glyph{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:var(--shell-orange-fill);color:var(--shell-orange)}
.m-notice__glyph svg{display:block;width:18px;height:18px}
.m-notice__title{flex:1;min-width:0;margin:0;font:400 17px/22px ${font};overflow-wrap:anywhere}
.m-notice__retry{flex:none;box-sizing:border-box;height:44px;margin:0;padding:0 20px;border:0;border-radius:999px;background:var(--shell-fill);color:var(--shell-label);font:600 17px/22px ${font};cursor:pointer;appearance:none;-webkit-appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.m-notice__retry:active{background:var(--shell-fill-pressed)}
}
`;
