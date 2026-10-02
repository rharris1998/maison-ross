// Maison's layouts by its own width (#29), with no React, so
// the Node tests can import it. layout.js re-exports it beside its hooks.
export const WIDE_MIN = 700, DESKTOP_MIN = 1100;
// Sheets cover the viewport, so they follow this query rather than Maison's width.
export const WIDE_QUERY = `(min-width:${WIDE_MIN}px)`;

// 'phone' below 700px, 'wide' from 700 to 1099, 'desktop' from 1100.
export const layoutFor = width => width < WIDE_MIN ? 'phone' : width < DESKTOP_MIN ? 'wide' : 'desktop';
