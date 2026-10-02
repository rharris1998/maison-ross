// A Home Assistant card inside Maison (#27): the full calendar or a history
// graph, each in a dialog. React draws only the empty
// slot; the element owns what goes in it. NativeContext carries the element's
// `attachNative(slot, key, config)`, which places one card per key there and
// keeps it current, or a note when the card can't load. The gallery provides
// nothing, and its slots stay empty.
import {createContext, useContext, useEffect, useRef} from 'react';

export const NativeContext = createContext(null);

// `key` names the card ('calendar-full', 'history-full-power',
// 'history-full-climate-attic-temperature'…); `config` is its card config. A
// key's config never changes, so only a new slot or key attaches again.
export function Native({value: {key, config}}) {
  const attach = useContext(NativeContext), slot = useRef(null);
  useEffect(() => { attach?.(slot.current, key, config); }, [attach, key]);
  return <div className="native" data-native={key} ref={slot}/>;
}
