// The feedback line (#29 step 4): footnote in --m-label-2 under its
// control, wrapping anywhere so a long entity name never widens a sheet.
// It is the secondary label, 4.5:1 or more on every surface a sheet has.
export const feedbackStyles = `
.m-feedback{margin:0;min-width:0;font:var(--m-type-footnote);color:var(--m-label-2);overflow-wrap:anywhere}
`;
