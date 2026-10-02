// The card (#29): the list's surface with 16px of padding and a headline
// title 8px above what follows; the 22px title style is only for the
// section headers between cards.
export const cardStyles = `
.m-card{box-sizing:border-box;min-width:0;margin:0;padding:var(--m-card-padding);background:var(--m-card-fill);border:.5px solid var(--m-card-border);border-radius:var(--m-radius-card);color:var(--m-label)}
.m-card__title{margin:0 0 var(--m-space-2);font:var(--m-type-headline);color:var(--m-label)}
.m-section-title{margin:var(--m-space-3) var(--m-space-1) 0;font:var(--m-type-title);color:var(--m-label)}
`;
