// Maison's card (#29): the grouped surface every widget sits on, frosted in
// dark (a translucent fill with a hairline edge) and white on the light
// page. It replaces src/parts.jsx's SectionCard and Title, and SectionTitle
// replaces SectionHeading. A card is static: one that opens something holds
// a pressable row or button instead.

/**
 * A card: the grouped surface every widget sits on. Widget sizes come in step
 * 4 of #29.
 *
 * DOM: `<{as} class="m-card {className}">`, holding `h{level}.m-card__title`
 * (headline, --m-label) when there is a `title`, then the children. A caller
 * may draw its own `.m-card__title` as its first child instead.
 *
 * Look: --m-card-fill, a 0.5px --m-card-border, radius --m-radius-card,
 * padding var(--m-card-padding). A plain List inside sits flush with the
 * title.
 *
 * @param {object} props
 * @param {string} [props.className]
 * @param {string} [props.title] Visible text, from the value.
 * @param {2|3|4|5|6} [props.level=3] The title's heading level.
 * @param {import('react').ReactNode} props.children
 * @param {string} [props.as='section'] The element to draw.
 */
export function Card({className, title, level = 3, children, as: Element = 'section'}) {
  const Heading = `h${level}`;
  return <Element className={className ? `m-card ${className}` : 'm-card'}>{title && <Heading className="m-card__title">{title}</Heading>}{children}</Element>;
}

/**
 * A section's header between cards, such as Zones or Housekeeping: the title
 * style, inset 4px so it lines up with the cards' curve.
 *
 * DOM: `h{level}.m-section-title`.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children Visible text, from the value.
 * @param {2|3|4|5|6} [props.level=2]
 */
export function SectionTitle({children, level = 2}) {
  const Heading = `h${level}`;
  return <Heading className="m-section-title">{children}</Heading>;
}
