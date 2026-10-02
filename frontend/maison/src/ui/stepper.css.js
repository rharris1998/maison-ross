// The stepper (#29): two gray 36px circles 10px either side of the value, a
// figure in the rounded face with tabular digits. The buttons keep the
// button's own states (pressed, disabled) and its 44px hit area; the value
// never shifts, because a missing side leaves a spacer of the same width and
// the value is 64px wide at least, room for "20.5°" or "100%".
export const stepperStyles = `
.m-stepper{display:inline-flex;align-items:center;gap:10px;flex:none}
.m-stepper__step,.m-stepper__spacer{flex:none;width:var(--m-control);height:var(--m-control)}
.m-stepper__step.m-button .m-glyph{width:18px;height:18px}
.m-stepper__spacer{display:block}
.m-stepper__value{min-width:64px;font:var(--m-type-figure);font-variant-numeric:tabular-nums;color:var(--m-label);text-align:center;white-space:nowrap}
`;
