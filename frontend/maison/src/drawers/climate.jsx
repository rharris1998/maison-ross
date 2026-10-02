// Climate's sheets (#29 step 4, v32): the House, a
// zone's and the towel rails', drawn in Maison's Sheet from climate.js's
// Drawer bodies as iOS grouped sections, each headed by a value's words over
// an inset list or a card, with a caption under it where the value has one.
// Every control the page leaves out lives here: the house override and
// Away, a zone's target, schedule and Airco, Warm the house too, and the
// charts. Nothing is composed in React: every word, heading and name is the
// value's, and a section the value has no heading for has none. One button
// per sheet is filled at most (the house override's Hold, tinted while the
// heating is off, so an override that can't warm isn't the sheet's primary);
// a needs-you warning is the only orange, as its glyph. Buttons fill a
// bottom sheet's width and keep their own in a form sheet. The charts sit
// bare on the sheet, under their own titles, as C drew them: a chart's
// scrubbed point is ringed in the sheet's fill, which a dark card's
// translucent fill has no token to match.
//
// A control that had focus and leaves (a Cancel whose override or Away
// ended, a stepper side at its limit) hands focus to its section's first
// control, or to the section's heading, rather than to the sheet's Close.
import {useEffect, useLayoutEffect, useRef} from 'react';
import {IntentButton} from '../ui/button.jsx';
import {Card} from '../ui/card.jsx';
import {DateTimeField} from '../ui/date-field.jsx';
import {DayBar} from '../ui/day-bar.jsx';
import {Disclosure} from '../ui/disclosure.jsx';
import {Feedback} from '../ui/feedback.jsx';
import {Figure} from '../ui/figure.jsx';
import {Glyph} from '../ui/glyph.jsx';
import {List, ListRow} from '../ui/list.jsx';
import {SegmentedControl} from '../ui/segmented.jsx';
import {useSheetPlacement} from '../ui/sheet.jsx';
import {Stepper} from '../ui/stepper.jsx';
import {IntentSwitch} from '../ui/switch.jsx';
import {TargetBar} from '../ui/target-bar.jsx';
import {HistoryChart} from '../charts/history.jsx';

// One grouped section: its heading from the value (none without one), what
// it groups, then its footer caption. `focus` names a section whose
// controls come and go, where a lost focus returns (useKeptFocus).
const Section = ({title, footer, focus, children}) => <section className="m-climate-sheet__section" data-focus-section={focus}>
  {title && <h3 className="m-climate-sheet__heading">{title}</h3>}{children}{footer && <p className="m-climate-sheet__footer">{footer}</p>}
</section>;

// The section of the body `el` sits in, by its key: the body's child that
// holds it, while it has one.
const sectionOf = (root, el) => { while (el && el.parentElement !== root) el = el.parentElement; return el?.dataset.focusSection ? el : null; };
// What a Tab reaches in a section, in order: enabled, in the order, and
// drawn (not in a closed panel).
const reachable = section => [...section.getElementsByTagName('*')].find(el => el.tabIndex >= 0 && !el.disabled && el.getClientRects().length > 0);

/**
 * Keeps focus in a sheet body when the control that had it leaves (r2#4):
 * after a commit that removed it, focus goes to the first reachable control
 * of the section it was in (by `data-focus-section`, the section now in its
 * place included), or to that section's heading, made focusable with
 * tabIndex -1. Without this, React Aria's modal hands it to the sheet's
 * Close, and a keyboard or VoiceOver user loses their place. Focus that has
 * moved out of the body on its own is left alone.
 * @returns {{current: HTMLElement|null}} The body's root, to put on its element.
 */
function useKeptFocus() {
  const root = useRef(null), last = useRef(null);
  useEffect(() => {
    const node = root.current;
    const focusin = event => { const key = sectionOf(node, event.target)?.dataset.focusSection; last.current = key ? {element: event.target, key} : null; };
    const focusout = event => { if (event.relatedTarget && !node.contains(event.relatedTarget)) last.current = null; };
    node.addEventListener('focusin', focusin);
    node.addEventListener('focusout', focusout);
    return () => { node.removeEventListener('focusin', focusin); node.removeEventListener('focusout', focusout); };
  }, []);
  useLayoutEffect(() => {
    const lost = last.current;
    if (!lost || lost.element.isConnected) return;
    last.current = null;
    const section = [...root.current.children].find(el => el.dataset.focusSection === lost.key);
    const heading = section?.firstElementChild?.localName === 'h3' ? section.firstElementChild : null;
    const target = section && (reachable(section) ?? heading);
    if (!target) return;
    if (target === heading) target.tabIndex = -1;
    target.focus();
  });
  return root;
}

// A section's buttons: the regular size (36px, a 44px hit), as every
// Maison button beside a list is, so a long label ("Warm the house until
// 18:00 too") fits on a card in a 375px phone's sheet; the bottom sheet's
// width there, their own width in a form sheet, where a 592px slab would
// outweigh its section.
function Actions({actions}) {
  const wide = useSheetPlacement() === 'bottom';
  return <div className="m-climate-sheet__actions">{actions.filter(Boolean).map(([action, variant]) =>
    <IntentButton key={action.intent.command} action={action} variant={variant} wide={wide}/>)}</div>;
}

// A card of the value's sentences, one paragraph each.
const Prose = ({lines}) => <Card as="div" className="m-climate-sheet__card">{lines.map((line, i) => <p key={i} className="m-climate-sheet__text">{line}</p>)}</Card>;

// A needs-you line: an orange warning glyph before the value's words, in
// the secondary label. Nothing while there is no warning.
const Warning = ({text}) => text ? <p className="m-climate-sheet__warning"><Glyph name="alert" className="m-climate-sheet__warning-glyph"/><span className="m-climate-sheet__warning-text">{text}</span></p> : null;

// A list row whose own words sit over a part of the row's full width (the
// override's ends, a zone's day), drawn in the row's classes so the list's
// padding and hairlines hold. The ends reach 8px into the row's inset, so
// "Until 22:00" fits a 327px sheet.
const StackedRow = ({children}) => <div className="m-row m-row--bare m-climate-sheet__stacked">{children}</div>;

// A setting: a row titled by its Step, the detail under the title, its
// stepper as the accessory, or none while it can't be stepped. Where the
// title's longest word and the stepper don't fit side by side (a 327px
// sheet), the stepper wraps under the title, at the row's end, rather than
// the title breaking mid-word (climate.css.js). The stepper's
// group is named by the row's title, unless its value already is (comfort,
// setback: r1#17), so the name isn't spoken twice.
const Setting = ({title, detail, stepper}) => <ListRow title={title} detail={detail}
  accessory={stepper && <Stepper {...stepper} label={title === stepper.outputLabel ? undefined : title}/>}/>;

// A link out of the sheet (a schedule or the Airco in Home Assistant): a
// plain button whose glyph lines up with the headings.
const LinkOut = ({link}) => link ? <IntentButton action={link} variant="plain" className="m-climate-sheet__link"/> : null;

// The reading at the top of a house or zone sheet: the figure, its named
// bar, the line, then the facts with a reading as one caption line. The
// figure is hidden from assistive technology, as the bar's name starts with
// the reading (or says there is none); with no reading its dash is
// secondary, as on the page. Each fact shows its glyph and short words
// ('48%'), hidden, and is read by its name ('48% humidity'); a humidity flag
// follows as a badge, read as it is.
const Summary = ({reading, facts}) => <section className="m-climate-sheet__summary">
  <div className={typeof reading.bar.plot.reading === 'number' ? 'm-climate-sheet__figure' : 'm-climate-sheet__figure m-climate-sheet__figure--empty'} aria-hidden="true">
    <Figure value={reading.reading}/></div>
  <TargetBar bar={reading.bar} size="wide"/>
  <p className="m-climate-sheet__line">{reading.line}</p>
  {facts.length > 0 && <p className="m-climate-sheet__facts">{facts.map((fact, i) => <span key={i} className="m-climate-sheet__fact">
    <span className="m-climate-sheet__fact-text" aria-hidden="true">{fact.icon && <Glyph name={fact.icon}/>}{fact.text}</span>
    <span className="m-visually-hidden">{fact.ariaLabel}</span>{fact.flag && <span className="m-climate-sheet__flag">{fact.flag}</span>}</span>)}</p>}
</section>;

// The 24-hour charts, each a section of its own under its own title, then
// the radiators as read-only rows: each valve's setting under its name, its
// probe a figure over the probe's caption. A single radiator names itself,
// so its section has no heading (`heading` is null).
const Charts = ({charts}) => charts.map(chart => <section key={chart.full.intent.entity} className="m-climate-sheet__section m-climate-sheet__chart">
  <HistoryChart value={chart}/></section>);
const Radiators = ({radiators: {heading, rows, note}}) => <Section title={heading} footer={note}>
  <List>{rows.map(row => <ListRow key={row.name} title={row.name} detail={row.line} trailing={<span className="m-climate-sheet__probe">
    <span className="m-climate-sheet__probe-value m-num">{row.probe}</span><span className="m-climate-sheet__probe-caption">{row.probeCaption}</span></span>}/>)}</List>
</Section>;

// ---- House -----------------------------------------------------------------

// The house override, headed by its Step: the temperature's stepper and the
// end's segmented control in one group, its footer while an override runs,
// then Hold (the sheet's one filled button, tinted while the heating is off
// and it can't warm) and Cancel override while one runs, and what became of
// the last write. A clock or heating-off warning shares a card with the
// buttons it is about, as Radiator heat's does, so a tinted Hold sits on a
// card (4.6:1 in light, where the bare sheet gives 4.1:1).
function Override({control, titles}) {
  const {step, ends, start, cancel} = control;
  const actions = <Actions actions={[[start, control.offWarning ? 'tinted' : 'filled'], cancel && [cancel, 'gray']]}/>;
  return <Section title={step.title} focus="control">
    <List>
      <ListRow title={titles.temperature} accessory={step.stepper && <Stepper {...step.stepper} label={titles.temperature}/>}/>
      {ends.length > 0 && <StackedRow><span className="m-row__title">{titles.ends}</span><SegmentedControl ariaLabel={control.endsLabel} items={ends} className="m-climate-sheet__ends"/></StackedRow>}
    </List>
    {control.footer && <p className="m-climate-sheet__footer">{control.footer}</p>}
    {control.clockWarning || control.offWarning
      ? <Card as="div" className="m-climate-sheet__card"><Warning text={control.clockWarning}/><Warning text={control.offWarning}/>{actions}</Card> : actions}
    <Feedback text={control.feedback}/>
  </Section>;
}

// Away, behind its disclosure, on one card: what it does, the native date
// and time field with its hint, a needs-you line while the chosen time is
// out of range (iOS's wheels don't hold it to min and max), then Set Away.
const Away = ({away}) => <Disclosure title={away.summary}>
  <div className="m-climate-sheet__panel">
    <Card as="div" className="m-climate-sheet__card">
      <p className="m-climate-sheet__text">{away.text}</p><DateTimeField field={away.field} hint={away.hint}/><Warning text={away.warning}/>
      <Actions actions={[[away.set, 'tinted']]}/>
    </Card>
  </div>
</Disclosure>;

// The house control by its kind: the override with Away after it; Away
// running, with Cancel Away; the thermostat unknown; or not set up yet.
function HouseControl({control, titles}) {
  if (control.kind === 'override') return <><Override control={control} titles={titles}/><Away away={control.away}/></>;
  if (control.kind === 'away') return <Section title={control.title} focus="control">
    <Prose lines={[control.text]}/>
    <Actions actions={[[control.cancel, 'gray']]}/>
    <Feedback text={control.feedback}/>
  </Section>;
  if (control.kind === 'unknown') return <Section focus="control"><Prose lines={[control.text]}/><Feedback text={control.feedback}/></Section>;
  return <Section focus="control"><List><Setting {...control.step}/></List></Section>;
}

// The thermostat's week: a card of its days as a list, today marked, and
// its note; or its one sentence while it has none.
const Week = ({week: {title, days, text, note}}) => <Section title={title} footer={note}>
  {days ? <Card as="div" className="m-climate-sheet__card"><div className="m-climate-sheet__days" role="list">{days.map(day => <DayBar key={day.name} day={day}/>)}</div></Card>
    : <Prose lines={[text]}/>}
</Section>;

/**
 * The House sheet's body.
 *
 * DOM: `div.m-climate-sheet.m-climate-sheet--house` holding, in order:
 * - `section.m-climate-sheet__summary`: the Figure (the reading, large) in
 *   `div.m-climate-sheet__figure[aria-hidden]` (plus `--empty`, its dash
 *   secondary, with no reading), a named wide TargetBar,
 *   `p.m-climate-sheet__line` and, while there are any, `body.facts` as
 *   `p.m-climate-sheet__facts` (each fact's glyph and words in an
 *   `aria-hidden` `span.m-climate-sheet__fact-text`, its `ariaLabel` in a
 *   `span.m-visually-hidden`, its flag as `span.m-climate-sheet__flag`);
 * - the house control, by `body.control.kind`, each a
 *   `section.m-climate-sheet__section[data-focus-section=control]` (an
 *   `h3.m-climate-sheet__heading` from the value when it has one, a
 *   `p.m-climate-sheet__footer` caption):
 *   - override: headed `step.title`, an inset List of the Temperature row
 *     (`titles.temperature`, the Stepper as its accessory) and the Ends row
 *     (`titles.ends` over the full-width SegmentedControl named `endsLabel`,
 *     only with ends), `control.footer` as the caption while it has one,
 *     then `div.m-climate-sheet__actions`: `start`, the sheet's only filled
 *     button (tinted while `offWarning` says the heating is off), and
 *     `cancel` in gray, both regular size, as wide as a bottom sheet and
 *     their own width in a form sheet; with a clock or heating-off warning
 *     (`p.m-climate-sheet__warning`: an orange glyph, the words in the
 *     secondary label), the warnings and the buttons share a card; then
 *     Feedback; then the Away Disclosure (`away.summary`), holding one card
 *     of `away.text`, the DateTimeField (`away.field`, `away.hint`),
 *     `away.warning` as a needs-you line and `away.set`, tinted;
 *   - away: headed `title`, a card of `text`, `cancel` in gray, Feedback;
 *     when a Cancel that had focus leaves, focus goes to this section's
 *     first control, or its heading (useKeptFocus);
 *   - unknown: a card of `text`, Feedback;
 *   - missing: an inset List of one row, the Step's title over its detail;
 * - the Why Disclosure (`titles.why`), holding a card of the `why` lines;
 * - the week, headed `week.title`: a card holding its DayBars in
 *   `div.m-climate-sheet__days[role=list]` (or a card of `week.text`),
 *   `week.note` as the caption;
 * - each chart, `section.m-climate-sheet__chart` holding HistoryChart;
 * - Outside, while `outdoor` has a reading: headed `outdoor.title`, a card
 *   of `outdoor.text`;
 * - the radiators, headed `radiators.heading` (none over a single row): an
 *   inset List of read-only rows (name, `line` as the detail,
 *   `span.m-climate-sheet__probe` with the probe as a figure over
 *   `probeCaption`), `radiators.note` as the caption.
 *
 * @param {object} props
 * @param {object} props.body climate.js's HouseDrawer.
 */
export function HouseDrawer({body}) {
  const root = useKeptFocus();
  return <div className="m-climate-sheet m-climate-sheet--house" ref={root}>
    <Summary reading={body.reading} facts={body.facts}/>
    <HouseControl control={body.control} titles={body.titles}/>
    <Disclosure title={body.titles.why}><div className="m-climate-sheet__panel"><Prose lines={body.why}/></div></Disclosure>
    <Week week={body.week}/>
    <Charts charts={body.charts}/>
    {body.outdoor && <Section title={body.outdoor.title}><Prose lines={[body.outdoor.text]}/></Section>}
    <Radiators radiators={body.radiators}/>
  </div>;
}

// ---- Zone ------------------------------------------------------------------

// Why the zone won't warm, as a needs-you line, and "Warm the house … too"
// while it is offered, on the section's card (the tinted button reads 4.6:1
// there in light, 4.1:1 on the bare sheet), then its note and its write's
// feedback; or the warning that the house heating isn't calling. Headed
// `titles.warm`.
function RadiatorHeat({warm, warning, title}) {
  if (!warm && !warning) return null;
  return <Section title={title} focus="warm">
    <Card as="div" className="m-climate-sheet__card">
      <Warning text={warm ? warm.text : warning}/>{warm?.warm && <Actions actions={[[warm.warm, 'tinted']]}/>}
    </Card>
    {warm?.note && <p className="m-climate-sheet__footer">{warm.note}</p>}
    <Feedback text={warm?.feedback}/>
  </Section>;
}

// The zone's target, headed `titles.target`: its row ('Target now' and what
// changing it does, or the running override and its end) with the Step's
// stepper (or "Not set up yet" alone), Cancel override while one runs, and
// what became of the last write.
const Target = ({control, title}) => <Section title={title} focus="target">
  <List><Setting title={control.title} detail={control.line} stepper={control.step.stepper}/></List>
  {control.cancel && <Actions actions={[[control.cancel, 'gray']]}/>}
  {control.kind !== 'missing' && <Feedback text={control.feedback}/>}
</Section>;

// A scheduled zone's day, headed by the schedule's title: today's bar (a
// list of one day; the heading already says it is today, so the bar doesn't
// say it again) with the caption, only what the zone's line doesn't say, in
// one row; comfort and setback with their steppers and their lines; the
// note under them, their writes' feedback, then the schedule in Home
// Assistant.
const Schedule = ({schedule: {title, today, caption, note, comfort, setback, link}}) => <Section title={title} focus="schedule">
  <List>
    {(today || caption) && <StackedRow>
      {today && <div className="m-climate-sheet__days" role="list"><DayBar day={{...today, today: null}}/></div>}{caption && <span className="m-row__detail">{caption}</span>}
    </StackedRow>}
    <Setting title={comfort.step.title} detail={comfort.line} stepper={comfort.step.stepper}/>
    <Setting title={setback.step.title} detail={setback.line} stepper={setback.step.stepper}/>
  </List>
  {note && <p className="m-climate-sheet__footer">{note}</p>}
  <Feedback text={comfort.feedback}/><Feedback text={setback.feedback}/>
  <LinkOut link={link}/>
</Section>;

// An Airco switch as a row: its title over its line (none while it is
// unavailable, so it never reads as off), the switch as the accessory,
// 'Unavailable' or 'Offline' before it; or not set up yet.
const AircoSwitch = ({value: s}) => s.kind === 'missing' ? <Setting {...s.step}/>
  : <ListRow title={s.title} detail={s.line ?? undefined} value={s.note || undefined} accessory={<IntentSwitch control={s.control} note={s.note}/>}/>;

// The Attic's heat source and cooling, headed by its title: the source now
// (its first part strong) and the two switches in one group, their writes'
// feedback, then the Airco's own controls.
const Airco = ({airco: {title, source, heating, cooling, link}}) => <Section title={title} focus="airco">
  <List>
    <div className="m-row m-row--bare"><span className="m-row__title">{source.map((part, i) => typeof part === 'string' ? part : <strong key={i} className="m-climate-sheet__strong">{part.strong}</strong>)}</span></div>
    <AircoSwitch value={heating}/>
    <AircoSwitch value={cooling}/>
  </List>
  {[heating, cooling].map((s, i) => s.kind === 'switch' && <Feedback key={i} text={s.feedback}/>)}
  <LinkOut link={link}/>
</Section>;

/**
 * A zone's sheet body.
 *
 * DOM: `div.m-climate-sheet.m-climate-sheet--zone` holding, in order:
 * - the summary, as the House sheet's;
 * - Radiator heat (headed `titles.warm`), while there is a warm offer or a
 *   warning: a card of the offer's text (or `warning`) as a needs-you line
 *   and its button (tinted), then its note as the caption and
 *   Feedback;
 * - the target (headed `titles.target`): an inset List of one row,
 *   `control.title` over `control.line` with the Step's Stepper as its
 *   accessory ("Not set up yet" alone), `cancel` in gray while an override
 *   runs, Feedback;
 * - a scheduled zone's day (headed `schedule.title`): an inset List of
 *   today's DayBar (in a `role=list` of one) with `schedule.caption` under
 *   it (the row left out while it has neither), then the comfort and
 *   setback rows (the Step's title over the helper's `line`) with their
 *   Steppers; `schedule.note` as the caption; their Feedback;
 *   `schedule.link` as a plain button;
 * - the Attic's Airco (headed `airco.title`): an inset List of the source
 *   line (`strong` parts in headline) and a row per switch (title, `line`,
 *   its note as the value, IntentSwitch as the accessory, or its missing
 *   Step); their Feedback; `airco.link` as a plain button;
 * - the charts and the radiators, as the House sheet's.
 * No Disclosure: every control stays in the Tab order with a name of its
 * own, "Raise comfort" included.
 *
 * @param {object} props
 * @param {object} props.body climate.js's ZoneDrawer.
 */
export function ZoneDrawer({body}) {
  const root = useKeptFocus();
  return <div className="m-climate-sheet m-climate-sheet--zone" ref={root}>
    <Summary reading={body.reading} facts={body.facts}/>
    <RadiatorHeat warm={body.warm} warning={body.warning} title={body.titles.warm}/>
    <Target control={body.control} title={body.titles.target}/>
    {body.schedule && <Schedule schedule={body.schedule}/>}
    {body.airco && <Airco airco={body.airco}/>}
    <Charts charts={body.charts}/>
    <Radiators radiators={body.radiators}/>
  </div>;
}

// ---- Rails -----------------------------------------------------------------

// A rail's button: Dry towels tinted; Stop gray, as the sheets' other ways
// back (Cancel override, Cancel Away) are, and as the page draws it.
const railVariant = control => control.intent.command === 'drying-stop' ? 'gray' : 'tinted';

/**
 * The towel rails' sheet body.
 *
 * DOM: `div.m-climate-sheet.m-climate-sheet--rails` holding, in order:
 * - a section with no heading (the sheet's title names the rails): an
 *   inset List of the rail rows as on the page (the `bath` tile, the name
 *   over `line`, `row.action` as the accessory: Dry towels tinted, Stop
 *   gray, none while Away or unavailable), `caption` as the footer;
 * - the charts, as the House sheet's. No Radiators section: each rail's
 *   line already gives its setting and its reading, and `caption` says what
 *   sets them.
 *
 * @param {object} props
 * @param {object} props.body climate.js's RailsDrawer.
 */
export function RailsDrawer({body}) {
  const root = useKeptFocus();
  return <div className="m-climate-sheet m-climate-sheet--rails" ref={root}>
    <Section footer={body.caption} focus="rails">
      <List>{body.rows.map(row => <ListRow key={row.name} icon={row.icon} title={row.name} detail={row.line}
        accessory={row.action && <IntentButton action={row.action} variant={railVariant(row.action)}/>}/>)}</List>
    </Section>
    <Charts charts={body.charts}/>
  </div>;
}
