// The sheets section of the gallery (#29). A sheet is a modal, so the
// page shows its anatomy as still specimens (the same classes, drawn in place
// and inert, in a stage the size of a small viewport), and buttons open the
// real ones: the Attic Climate drawer, the home alerts, a calendar event and
// a Home Assistant card (the full calendar, v35), each drawn from the values
// the dashboard draws, the dialogs' bodies Maison's own (DIALOGS).
// Inside an open sheet presses act on nothing, except its close intent,
// which shuts it.
import {useCallback, useMemo, useState} from 'react';
import {CommandContext} from '../contexts.js';
import {TODAY_BUSY, climateSnapshot, dialogSnapshot, pageSnapshot, useScreen} from '../gallery-snapshots.js';
import {TODAY_NOW} from '../../fixtures/today-fixtures.js';
import {Button} from '../ui/button.jsx';
import {Glyph} from '../ui/glyph.jsx';
import {DIALOGS} from '../dialogs.jsx';
import {DialogSheet, DrawerSheet} from '../sheets.jsx';
import {GalleryGroup, GallerySection, Specimen} from './section.jsx';

// The real sheets, by the button that opens each.
const OPENERS = [['zone', 'Open zone sheet'], ['alerts', 'Open alerts sheet'], ['event', 'Open event sheet'], ['card', 'Open card sheet']];

// A sheet drawn in place, not as a modal: the Sheet's classes around a
// dialog's body, in a stage that stands in for the viewport (its
// --visual-viewport-height bounds the sheet as React Aria's does).
function Anatomy({placement, value}) {
  const Body = DIALOGS[value.kind];
  return <div className={`m-gallery-sheets__stage m-gallery-sheets__stage--${placement}`} aria-hidden="true" inert>
    <div className="m-sheet" data-placement={placement}><div className="m-sheet__dialog">
      {placement === 'bottom' && <div className="m-sheet__grabber"/>}
      <header className="m-sheet__header">
        <div className="m-sheet__heading"><p className="m-sheet__eyebrow">{value.eyebrow}</p><h2 className="m-sheet__title">{value.title}</h2></div>
        <span className="m-button m-button--glass m-button--regular m-button--icon-only m-sheet__close"><Glyph name="close"/></span>
      </header>
      <div className="m-sheet__body"><Body value={value}/></div>
    </div></div>
  </div>;
}

export function SheetsSection() {
  const screen = useScreen(), [open, setOpen] = useState(null);
  const values = useMemo(() => ({
    zone: screen(climateSnapshot('house_running', {detail: 'attic'})).drawer,
    alerts: screen(dialogSnapshot('alerts')).dialog,
    event: screen(pageSnapshot(TODAY_BUSY, 'today', TODAY_NOW, undefined, {kind: 'event', event: TODAY_BUSY.agenda.events[1]})).dialog,
    card: screen(dialogSnapshot('calendar')).dialog,
  }), [screen]);
  // A sheet's close intent shuts it; every other press acts on nothing.
  const command = useCallback(async intent => { if (intent?.command === 'close') setOpen(null); }, []);
  return <GallerySection name="sheets" title="Sheets" note="A bottom sheet below 700px, a form sheet from 700px; swipe the grabber or header down to dismiss">
    <GalleryGroup title="Anatomy">
      <div className="m-gallery-sheets">
        <Specimen caption="Bottom sheet: grabber, header, body"><Anatomy placement="bottom" value={values.alerts}/></Specimen>
        <Specimen caption="Form sheet, from 700px"><Anatomy placement="center" value={values.event}/></Specimen>
      </div>
    </GalleryGroup>
    <GalleryGroup title="Open one">
      <div className="m-gallery-row">{OPENERS.map(([key, label]) => <Button key={key} label={label} onPress={() => setOpen(key)}/>)}</div>
    </GalleryGroup>
    <CommandContext.Provider value={command}>
      <DrawerSheet value={open === 'zone' ? values.zone : null} isOpen={open === 'zone'}/>
      <DialogSheet value={open && open !== 'zone' ? values[open] : null}/>
    </CommandContext.Provider>
  </GallerySection>;
}

// The stages: a phone-sized one for the bottom sheet, a wider one for the
// form sheet, each dimmed by the scrim as the page under a sheet is.
export const sheetsGalleryStyles = `
.m-gallery-sheets{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:var(--m-space-5);align-items:start}
.m-gallery-sheets .m-gallery__specimen{justify-items:stretch}
.m-gallery-sheets__stage{--visual-viewport-height:480px;position:relative;flex:1 1 auto;height:480px;display:grid;place-items:center;overflow:hidden;border-radius:var(--m-radius-card);border:.5px solid var(--m-card-border);background:linear-gradient(var(--m-scrim),var(--m-scrim)),var(--m-bg)}
.m-gallery-sheets__stage--bottom{max-width:390px}
.m-gallery-sheets__stage--center{--visual-viewport-height:420px;height:420px}
`;
