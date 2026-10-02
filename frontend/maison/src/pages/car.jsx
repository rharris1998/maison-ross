// The Car (#29 step 4, v34), drawn from car.js's value:
// under the unchanged hero, the battery, charging while the Car is plugged
// in, the charging energy and Automatic charging, stacked on a phone in the
// value's order; from 700px the value's widgets on the grid, sized by the
// value (four mediums while plugged in, else the battery large beside two
// mediums). The Battery card opens Battery and Charging energy opens
// Charging energy; Charge now, the limit stepper, Wake and Automatic
// charging stay on the page. Every word comes from the value and every
// press is a value's Link or Control: which charging form is drawn is the
// value's `kind`, never a Control's `enabled`, so a busy or offline control
// stays drawn, disabled or pending, in its place.
import {IntentButton} from '../ui/button.jsx';
import {Feedback} from '../ui/feedback.jsx';
import {Figure} from '../ui/figure.jsx';
import {List, ListRow} from '../ui/list.jsx';
import {Ring} from '../ui/ring.jsx';
import {Legend, SegmentBar} from '../ui/segment-bar.jsx';
import {QuietLine} from '../ui/quiet.jsx';
import {Stepper} from '../ui/stepper.jsx';
import {IntentSwitch} from '../ui/switch.jsx';
import {Widget, WidgetGrid} from '../ui/widget.jsx';
import {useLayout} from '../ui/layout.js';

// The ring's ticks from its plot: the reserve and the limit, each while known.
const ticksOf = plot => [{at: plot.reserve, kind: 'reserve'}, {at: plot.limit, kind: 'limit'}].filter(tick => typeof tick.at === 'number');

// The battery: its ring (regular on a phone and in the large widget, small
// in a medium one) beside what happens next, the ticks in words, each after
// a swatch in its tick's colour, and whether the level is live; in the
// large widget the ring stands over them. Opens Battery.
function BatteryWidget({id, size, value: {battery}}) {
  const phone = useLayout() === 'phone', {plot} = battery.ring;
  return <Widget id={id} size={size} title={battery.title} icon={battery.icon} link={battery.link}>
    <div className="m-car-page__battery">
      <Ring value={plot.fill} ticks={ticksOf(plot)} tone={plot.tone} stale={plot.stale} label={battery.label} ariaLabel={battery.ring.ariaLabel}
        size={phone || size === 'large' ? 'regular' : 'small'}/>
      <div className="m-car-page__copy">
        {battery.line && <p className="m-car-page__line">{battery.line}</p>}
        {battery.legend.length > 0 && <p className="m-car-page__legend">{battery.legend.map(item =>
          <span key={item.kind} className="m-car-page__legend-item"><span className={`m-car-page__tick m-car-page__tick--${item.kind}`}/>{item.text}</span>)}</p>}
        <p className="m-car-page__freshness">{battery.freshness}</p>
      </div>
    </div>
  </Widget>;
}

// A charging row in a plain list, its title in headline as a setting's
// is: the limit (its stepper named by the row's title) or Wake (its glyph,
// a moon while the Car sleeps, on a gray tile; the button tinted).
const LimitRow = ({limit, detail}) => <List variant="plain"><ListRow strong title={limit.title} detail={detail} accessory={<Stepper {...limit.stepper} label={limit.title}/>}/></List>;
const WakeRow = ({wake, detail}) => <List variant="plain"><ListRow strong icon={wake.icon} tone="gray" title={wake.title} detail={detail}
  accessory={<IntentButton action={wake.control} variant="tinted"/>}/></List>;

// Charging, by its form: Charge now (filled) or Return to automatic
// (gray), large and the card's width on a phone, the regular size and its
// own width from 700px; the charge limit's row with its stepper; Wake
// beside why it is needed; or the quiet line, with the widget's glyph,
// saying the controls return with the Charger; then each control's
// feedback that has something to say. From 700px, while a button stands
// over a row and a feedback line shows, the row's detail makes way for the
// line, so the body keeps to its 107px; a body holding a single row or line
// (no button, no feedback) is centred in it (`--single`).
function ChargeWidget({id, size, value: {charge}}) {
  const phone = useLayout() === 'phone', {kind, action, limit, wake, line, feedback} = charge;
  const lines = Object.entries(feedback).filter(([, text]) => text), detail = text => phone || !action || !lines.length ? text : undefined;
  return <Widget id={id} size={size} title={charge.title} icon={charge.icon}>
    <div className={`m-car-page__charge m-car-page__charge--${kind}${action || lines.length ? '' : ' m-car-page__charge--single'}`}>
      {action && <IntentButton action={action} variant={kind === 'ready' ? 'filled' : 'gray'} size={phone ? 'large' : 'regular'} wide={phone}/>}
      {limit && <LimitRow limit={limit} detail={detail(limit.detail)}/>}
      {wake && <WakeRow wake={wake} detail={detail(wake.detail)}/>}
      {line && <QuietLine icon={charge.icon} text={line}/>}
      {lines.length > 0 && <div className="m-car-page__feedback">{lines.map(([key, text]) => <Feedback key={key} text={text}/>)}</div>}
    </div>
  </Widget>;
}

// The charging energy: its sum over the period (the period above it on a
// phone, beside it from 700px, where the widget is one row high), the
// split by source and its legend. Opens Charging energy.
function EnergyWidget({id, size, value: {chargingEnergy: {title, icon, figure, bar, legend, link}}}) {
  const phone = useLayout() === 'phone';
  return <Widget id={id} size={size} title={title} icon={icon} link={link}>
    <div className="m-car-page__energy">
      <Figure label={figure.label} value={figure.value} unit={figure.unit} labelPlacement={phone ? 'above' : 'beside'}/>
      <div className="m-car-page__split"><SegmentBar segments={bar.segments} ariaLabel={bar.ariaLabel} empty={bar.kind === 'zero' ? 'zero' : 'missing'}/><Legend items={legend}/></div>
    </div>
  </Widget>;
}

// Automatic charging's row, its switch the accessory with the note (while
// the switch is offline or unavailable) before it, unless the row is
// titled by it; then the switch's feedback. On a phone it is the stack's
// item itself, so it carries the widget's id.
const AutomaticRow = ({automatic, id, variant, strong, title, detail}) => <div className="m-car-page__automatic" data-widget={id}>
  <List variant={variant}><ListRow strong={strong} title={title} detail={detail} value={title === automatic.note ? undefined : automatic.note || undefined}
    accessory={<IntentSwitch control={automatic.switch} note={automatic.note}/>}/></List>
  <Feedback text={automatic.feedback}/>
</div>;

// Automatic charging. On a phone one inset row with no Widget round it, as
// Energy's money list (the row names itself, so no heading sits over it):
// its title in headline over what it does. From 700px the widget, titled
// with its glyph, its row centred in the body: what it does, or while that
// isn't known (the switch unavailable) the note, so the row is never
// untitled and never repeats the widget's title.
function AutomaticWidget({id, size, value: {automatic}}) {
  if (useLayout() === 'phone') return <AutomaticRow automatic={automatic} id={id} variant="inset" strong title={automatic.title} detail={automatic.detail ?? undefined}/>;
  return <Widget id={id} size={size} title={automatic.title} icon={automatic.icon}>
    <AutomaticRow automatic={automatic} variant="plain" title={automatic.detail ?? automatic.note ?? automatic.title}/>
  </Widget>;
}

// Each widget by the value's id.
const WIDGETS = {battery: BatteryWidget, charge: ChargeWidget, energy: EnergyWidget, automatic: AutomaticWidget};
// At wide (two columns) a medium widget already fills its row alone, so a
// large one only adds an empty row: it draws medium there.
const WIDE = slot => slot.size === 'large' ? {...slot, size: 'medium'} : slot;

/**
 * The Car.
 *
 * DOM: `div.m-car-page` (not `m-car`, the hero chart's block) holding a
 * WidgetGrid as its direct child (no intro, and not the hero's line again):
 * `value.widgets` in order, stacked on a phone and placed by WidgetGrid
 * from 700px (while `value.charge`, four mediums; otherwise `battery` large
 * beside `energy` and `automatic`), a large widget drawn medium at wide
 * (WIDE), where a medium already fills its row:
 * - `battery` (linked, `battery.link`): `div.m-car-page__battery` holding a
 *   Ring (`ring.plot`'s fill, tone and stale, its reserve and limit as
 *   ticks, `label` in the centre, named by `ring.ariaLabel`; regular on a
 *   phone and in the large widget, small in a medium one) beside
 *   `div.m-car-page__copy` (over it, centred, in the large widget, where the
 *   line is in headline and the legend and freshness in subhead):
 *   `p.m-car-page__line` (`line`, while set), `p.m-car-page__legend` of
 *   `span.m-car-page__legend-item`s, each a
 *   `span.m-car-page__tick.m-car-page__tick--{kind}` swatch before its text
 *   (while the legend has any), then `p.m-car-page__freshness`;
 * - `charge` (not linked; only while `value.charge`):
 *   `div.m-car-page__charge.m-car-page__charge--{kind}` holding, each while
 *   set:
 *   - the `action` IntentButton, filled while `ready`, gray otherwise;
 *     large and wide on a phone, regular at its own width from 700px;
 *   - the limit as a plain List's `strong` ListRow (`limit.title`,
 *     `limit.detail`, a Stepper accessory named by the title);
 *   - Wake as a plain List's `strong` ListRow (a gray tile of `wake.icon`,
 *     `wake.title`, `wake.detail`, the control as a tinted IntentButton
 *     accessory);
 *   - a QuietLine (`charge.icon`, `line`);
 *   - `div.m-car-page__feedback`, a Feedback per non-empty `feedback`
 *     entry, in the value's order, only while any has something to say.
 *   From 700px, while the action is drawn and the feedback shows, the rows
 *   draw no detail. With neither the action nor any feedback, the div
 *   takes `.m-car-page__charge--single`: from 700px its one row or line is
 *   centred in the body;
 * - `energy` (linked, `chargingEnergy.link`): `div.m-car-page__energy`
 *   holding a Figure (its label above on a phone, beside from 700px; value,
 *   unit) and `div.m-car-page__split`, the SegmentBar (empty as `zero` or
 *   `missing` by `bar.kind`) over the Legend;
 * - `automatic` (not linked), drawn from `value.automatic`:
 *   `div.m-car-page__automatic` holding a List of one ListRow, its value the
 *   note while set (unless it titles the row) and an IntentSwitch accessory
 *   (`switch`, `note`), then Feedback (`feedback`). On a phone there is no
 *   Widget: the div is the stack's item (`data-widget="automatic"`), the
 *   List inset and its row `strong`, titled `title` over `detail` (none
 *   while null). From 700px the Widget, titled `title` with its `icon`,
 *   holds the div, centred in the body, the List plain and its row titled
 *   `detail`, or the note while `detail` is null.
 *
 * @param {object} props
 * @param {object} props.value car.js's CarPage.
 */
export function CarPage({value}) {
  const slots = useLayout() === 'wide' ? value.widgets.map(WIDE) : value.widgets;
  return <div className="m-car-page">
    <WidgetGrid>{slots.map(({id, size}) => {const Body = WIDGETS[id]; return <Body key={id} id={id} size={size} value={value}/>;})}</WidgetGrid>
  </div>;
}
