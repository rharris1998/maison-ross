// The picker (#29 step 4, v35), as iOS's pop-up button: a gray capsule
// 44px high, the chosen label in the body type (17px) in --m-label, then the
// chevron turned down (13px, secondary), 16px in from the start and 14px
// from the end (the chevron is optically lighter than a letter). It is as
// wide as its label and never wider than its line, where a long label is
// cut short. The native select lies over the whole capsule, unseen, in the
// same body type, so a tap anywhere on it opens the system's menu and iOS
// doesn't zoom in. A press deepens the fill at once and eases back over
// --m-dur-press; disabled, the label and the chevron turn tertiary. Nothing
// moves.
export const pickerStyles = `
.m-picker{position:relative;box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;max-width:100%;min-width:0;height:var(--m-hit);padding:0 14px 0 var(--m-space-4);border-radius:var(--m-radius-capsule);background:var(--m-fill-gray);color:var(--m-label);font:var(--m-type-body);transition:background-color var(--m-dur-press) var(--m-ease)}
.m-picker:has(>.m-picker__select:active){background:var(--m-fill-pressed);transition-duration:0ms}
.m-picker__label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-picker__chevron{width:13px;height:13px;rotate:90deg;color:var(--m-label-2)}
.m-picker[data-disabled]{color:var(--m-label-3)}
.m-picker[data-disabled] .m-picker__chevron{color:var(--m-label-3)}
.m-picker__select{position:absolute;inset:0;box-sizing:border-box;width:100%;height:100%;margin:0;padding:0;border:0;border-radius:inherit;opacity:0;font:var(--m-type-body);cursor:pointer;appearance:none;-webkit-appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.m-picker__select:disabled{cursor:default}
`;
