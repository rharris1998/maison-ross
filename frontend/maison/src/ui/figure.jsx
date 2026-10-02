// Maison's figure (#29 step 4): one reading set large, its unit beside it
// and its label above or beside it, such as today's solar generated. The
// reading is in the rounded face with tabular digits (.m-num), so a figure
// that updates never shifts; the unit and the label are secondary.

/**
 * A figure.
 *
 * DOM: `p.m-figure.m-figure--{labelPlacement}.m-figure--{size}` holding
 * `span.m-figure__label` (footnote, --m-label-2) when there is a `label`,
 * then `span.m-figure__reading`: `span.m-figure__value.m-num` (figure-large,
 * 44; figure, 22, with `size='regular'`) and `span.m-figure__unit` (subhead,
 * --m-label-2) when there is a `unit`, on the value's baseline. `above` puts
 * the label over the reading; `beside` puts it before the reading on the
 * same baseline, wrapping under it when the line is too narrow.
 *
 * @param {object} props
 * @param {string} [props.label] Visible text, from the value.
 * @param {string} props.value The reading ('11.5', '—'), from the value.
 * @param {string} [props.unit] Its unit ('kWh'), from the value.
 * @param {'above'|'beside'} [props.labelPlacement='above']
 * @param {'large'|'regular'} [props.size='large']
 */
export function Figure({label, value, unit, labelPlacement = 'above', size = 'large'}) {
  return <p className={`m-figure m-figure--${labelPlacement} m-figure--${size}`}>
    {label && <span className="m-figure__label">{label}</span>}
    <span className="m-figure__reading"><span className="m-figure__value m-num">{value}</span>{unit && <span className="m-figure__unit">{unit}</span>}</span>
  </p>;
}
