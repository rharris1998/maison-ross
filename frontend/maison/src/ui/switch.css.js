// The switch (#29): a 51×31 capsule, gray when off and green when on, whose
// thumb slides 20px and stretches while pressed, as iOS's does. The label
// carries React Aria's states and the focus ring (so the ring follows its
// capsule radius); an ::after reaches a 44px hit area. The unavailable switch
// is an outline, dashed, with a small thumb in its middle: never off.
export const switchStyles = `
.m-switch{position:relative;display:inline-flex;flex:none;vertical-align:middle;border-radius:var(--m-radius-capsule);cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.m-switch:not(.m-switch--unavailable)::after{content:"";position:absolute;inset:calc((var(--m-switch-h) - var(--m-hit)) / 2) 0}
.m-switch__track{position:relative;box-sizing:border-box;display:block;width:var(--m-switch-w);height:var(--m-switch-h);border-radius:var(--m-radius-capsule);background:var(--m-switch-off);transition:background-color var(--m-dur-control) var(--m-ease)}
.m-switch__thumb{position:absolute;top:2px;left:2px;width:var(--m-switch-thumb-size);height:var(--m-switch-thumb-size);border-radius:var(--m-radius-capsule);background:var(--m-switch-thumb);box-shadow:var(--m-switch-thumb-shadow);transition:translate var(--m-dur-control) var(--m-ease),width var(--m-dur-control) var(--m-ease)}
.m-switch[data-selected] .m-switch__track{background:var(--m-green)}
.m-switch[data-selected] .m-switch__thumb{translate:20px 0}
.m-switch[data-pressed] .m-switch__thumb{width:calc(var(--m-switch-thumb-size) + 6px)}
.m-switch[data-selected][data-pressed] .m-switch__thumb{translate:14px 0}
.m-switch[data-disabled]{opacity:.4;cursor:default}
.m-switch--unavailable{cursor:default}
.m-switch--unavailable .m-switch__track{background:transparent;border:1.5px dashed var(--m-label-3)}
.m-switch--unavailable .m-switch__thumb{top:50%;left:50%;width:17px;height:17px;translate:-50% -50%;background:var(--m-label-3);box-shadow:none;transition:none}
`;
