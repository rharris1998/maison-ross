// Which layout Maison draws (#29). The frame follows Maison's own
// width, which Home Assistant's sidebar narrows; a sheet follows the viewport
// it covers.
import {createContext, useContext, useEffect, useLayoutEffect, useState} from 'react';
import {WIDE_QUERY, layoutFor} from './breakpoints.js';

export {DESKTOP_MIN, WIDE_MIN, WIDE_QUERY, layoutFor} from './breakpoints.js';

/**
 * The layout the frame measured, for what it draws inside it: 'phone', 'wide'
 * or 'desktop'. frame.jsx provides it around the page; outside a frame
 * (a gallery specimen, a test) it is 'phone' unless a provider says
 * otherwise.
 */
export const LayoutContext = createContext('phone');
/** The layout the page is drawn in: LayoutContext's value. */
export const useLayout = () => useContext(LayoutContext);

// The layout for the element `ref` points at: 'phone', 'wide' or 'desktop'.
// The layout effect measures before the first paint and a ResizeObserver
// follows every change, so a page never flashes the wrong frame.
export function useFrameLayout(ref) {
  const [layout, setLayout] = useState(() => layoutFor(ref.current?.getBoundingClientRect().width ?? 0));
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => setLayout(layoutFor(node.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return layout;
}

// Whether the viewport is at least 700px wide: a sheet sits in the centre
// there, and at the bottom below.
export function useWideViewport() {
  const [wide, setWide] = useState(() => globalThis.matchMedia?.(WIDE_QUERY).matches ?? false);
  useEffect(() => {
    const query = globalThis.matchMedia?.(WIDE_QUERY);
    if (!query) return undefined;
    const update = () => setWide(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return wide;
}
