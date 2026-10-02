// Maison's two overlays (#29): the page's drawer and the dialog, drawn in
// Maison's Sheet (ui/sheet.jsx), the drawers' bodies from drawers.jsx (v32)
// and the dialogs' from dialogs.jsx (v35). Each is open while the screen
// has its value (App, in app.jsx, keeps the drawer shut while a dialog is
// open), keeps the last value while it closes so the content stays in
// place, and dismissing it sends the value's close intent.
import {useCommand} from './contexts.js';
import {Sheet, useLast} from './ui/sheet.jsx';
import {DIALOGS} from './dialogs.jsx';
import {DRAWERS} from './drawers.jsx';

/**
 * The Climate drawer in a Sheet: climate.js's Drawer's title, eyebrow and
 * body, drawn by `DRAWERS[body.kind]` (drawers.jsx): the House, a
 * zone's or the towel rails' sheet. Dismissing it sends
 * `value.close.intent`. It has no loading Skeleton, unlike src/drawer.jsx: a
 * Drawer value always carries its whole body (a chart still loading says so
 * inside it), and the sheet is open only while there is a value, so there
 * is never an open sheet with nothing to show.
 *
 * @param {object} props
 * @param {object|null} props.value climate.js's Drawer: {id, title, eyebrow, body, close}.
 * @param {boolean} props.isOpen App passes `!!drawer && !dialog`.
 */
export function DrawerSheet({value, isOpen}) {
  const command = useCommand(), shown = useLast(value), Body = shown && DRAWERS[shown.body.kind];
  return <Sheet isOpen={Boolean(isOpen && value)} title={shown?.title ?? ''} eyebrow={shown?.eyebrow} onDismiss={() => { if (value) command(value.close.intent); }}>
    {Body && <Body body={shown.body}/>}
  </Sheet>;
}

/**
 * The dialog in a Sheet: `DIALOGS[kind]` from dialogs.jsx (the home
 * alerts, a calendar event, or a Home Assistant card), with the value's
 * eyebrow and title. It is open while `value` is set; dismissing it sends
 * `value.close.intent`.
 *
 * @param {object} props
 * @param {object|null} props.value screen.js's Dialog.
 */
export function DialogSheet({value}) {
  const command = useCommand(), shown = useLast(value), Body = shown && DIALOGS[shown.kind];
  return <Sheet isOpen={Boolean(value)} title={shown?.title ?? ''} eyebrow={shown?.eyebrow} onDismiss={() => { if (value) command(value.close.intent); }}>
    {Body && <Body value={shown}/>}
  </Sheet>;
}
