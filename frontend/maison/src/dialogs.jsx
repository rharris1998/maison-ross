// Maison's dialog bodies (#29 step 4, v35), drawn in Maison's Sheet
// by DialogSheet (sheets.jsx) from screen.js's Dialog value by its kind: the
// home alerts, a calendar event, or a Home Assistant card (the full
// calendar, a history graph). Every word comes from the value and every
// press is a value's Link. Each body's one way on (Home status, the full
// calendar) is a wide gray button at its end, as an iOS sheet's: gray, as
// it opens rather than changes anything; the alert rows open their entities.
import {IntentButton} from './ui/button.jsx';
import {Card} from './ui/card.jsx';
import {List, ListRow} from './ui/list.jsx';
import {Native} from './native.jsx';

/**
 * The home alerts.
 *
 * DOM: `div.m-dialog.m-dialog--alerts` holding, in order:
 * - while there are `rows`: an inset List, each row a strong ListRow with
 *   its `link` (opening the entity), `icon`, `tone` ('amber', drawn orange:
 *   it needs you), `title` and `detail`;
 * - while `empty`: `div.m-dialog__empty`, as Home status draws an all-clear
 *   section: an inset List of one static ListRow with a gray `check` tile
 *   titled `empty[0]`, then each further line as `p.m-dialog__footnote`
 *   (footnote, secondary) 8px under the card;
 * - the `status` Link (Home status) as a wide, large gray IntentButton.
 *
 * @param {object} props
 * @param {{rows: object[], empty: string[]|null, status: object}} props.value screen.js's alerts Dialog.
 */
export function AlertsDialog({value: {rows, empty, status}}) {
  return <div className="m-dialog m-dialog--alerts">
    {rows.length > 0 && <List>{rows.map((row, i) => <ListRow key={i} link={row.link} icon={row.icon} tone={row.tone} title={row.title} detail={row.detail} strong/>)}</List>}
    {empty && <div className="m-dialog__empty">
      <List><ListRow key="clear" icon="check" tone="gray" title={empty[0]}/></List>
      {empty.slice(1).map((line, i) => <p key={i} className="m-dialog__footnote">{line}</p>)}
    </div>}
    <IntentButton action={status} variant="gray" size="large" wide/>
  </div>;
}

/**
 * A calendar event; its summary is the sheet's title.
 *
 * DOM: `div.m-dialog.m-dialog--event` holding, in order:
 * - `div.m-dialog__facts`: `p.m-dialog__date` (`date`, body: when comes
 *   first) over `p.m-dialog__location` (`location`, subhead, secondary,
 *   while there is one);
 * - `div.m-dialog__details`, 8px apart as a card and its footnote are:
 *   while there is a `description`, a card (`div.m-card.m-dialog__note`)
 *   holding `p.m-dialog__description`, its line breaks kept (a long one
 *   makes the sheet's body scroll); then `p.m-dialog__calendar`
 *   (`calendar`, footnote, secondary);
 * - the `full` Link (Full calendar) as a wide, large gray IntentButton.
 *
 * @param {object} props
 * @param {{date: string, location: string|null, description: string|null, calendar: string, full: object}} props.value screen.js's event Dialog.
 */
export function EventDialog({value: {date, location, description, calendar, full}}) {
  return <div className="m-dialog m-dialog--event">
    <div className="m-dialog__facts"><p className="m-dialog__date">{date}</p>{location && <p className="m-dialog__location">{location}</p>}</div>
    <div className="m-dialog__details">
      {description && <Card as="div" className="m-dialog__note"><p className="m-dialog__description">{description}</p></Card>}
      <p className="m-dialog__calendar">{calendar}</p>
    </div>
    <IntentButton action={full} variant="gray" size="large" wide/>
  </div>;
}

/**
 * A Home Assistant card in Maison's frame.
 *
 * DOM: `div.m-dialog.m-dialog--native` > `div.m-native` (the card surface,
 * which maps Home Assistant's card variables onto Maison's tokens) >
 * Native's `div.native[data-native={key}]`, the slot the element mounts the
 * card into, or its `p.note` when the card can't load.
 *
 * @param {object} props
 * @param {{native: {key: string, config: object}}} props.value screen.js's native Dialog.
 */
export function NativeDialog({value}) {
  return <div className="m-dialog m-dialog--native"><div className="m-native"><Native value={value.native}/></div></div>;
}

/** Each dialog's body by its kind. */
export const DIALOGS = {alerts: AlertsDialog, event: EventDialog, native: NativeDialog};
