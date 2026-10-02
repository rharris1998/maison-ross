// The segmented control (#29): a gray track of equal segments, the selected
// one lifted on a thumb that slides between them (React Aria's
// SelectionIndicator animates its `translate` from the old segment). A
// hairline sits between two unselected neighbours and fades as the thumb
// arrives. A pressed segment takes a fill at once, hiding the hairlines
// beside it, and lets it go over --m-dur-press (a dimmed label would read as
// disabled). Each segment reaches a 44px hit area with an ::after reaching
// above and below the 32px track.
export const segmentedStyles = `
.m-segmented{box-sizing:border-box;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);min-width:0;height:var(--m-segment-h);padding:2px;border-radius:var(--m-radius-segment);background:var(--m-fill-gray)}
.m-segmented__item{position:relative;box-sizing:border-box;display:grid;place-items:center;min-width:0;height:100%;margin:0;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--m-label);font:var(--m-type-footnote-strong);cursor:pointer;appearance:none;-webkit-appearance:none;touch-action:manipulation;user-select:none;-webkit-user-select:none;transition:background-color var(--m-dur-press) var(--m-ease)}
.m-segmented__item::after{content:"";position:absolute;inset:calc((var(--m-segment-h) - 4px - var(--m-hit)) / 2) 0}
.m-segmented__item::before{content:"";position:absolute;left:-.5px;top:6px;bottom:6px;width:1px;background:var(--m-separator);opacity:0;transition:opacity var(--m-dur-control) var(--m-ease)}
.m-segmented__item:not([data-selected])+.m-segmented__item:not([data-selected])::before{opacity:1}
.m-segmented__item:not([data-selected])+.m-segmented__item[data-pressed]:not([data-selected])::before,.m-segmented__item[data-pressed]:not([data-selected])+.m-segmented__item:not([data-selected])::before{opacity:0}
.m-segmented__thumb{position:absolute;inset:0;border-radius:7px;background:var(--m-segment-thumb);box-shadow:var(--m-segment-thumb-shadow);transition:translate var(--m-dur-control) var(--m-ease)}
.m-segmented__label{position:relative;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-segmented__item[data-pressed]:not([data-selected]){background:var(--m-fill-gray);transition-duration:0ms}
.m-segmented__item[data-focus-visible]{z-index:1}
.m-segmented__item[data-disabled]{color:var(--m-label-3);cursor:default}
.m-segmented[data-disabled] .m-segmented__thumb{opacity:.5}
`;
