// The pieces every gallery section is laid out with (#29), so the sections
// read as one page. gallery.jsx styles them (galleryStyles); a
// section's own layout goes in the `…GalleryStyles` its file exports.

// One section: `name` is its data-gallery-state, which the visual tests count
// and find; the heading is footnote-strong.
export function GallerySection({name, title, note, children}) {
  return <section className="m-gallery__section" data-gallery-state={name}>
    <header className="m-gallery__header"><h2 className="m-gallery__heading">{title}</h2>{note && <p className="m-gallery__note">{note}</p>}</header>
    {children}
  </section>;
}

// A titled group inside a section, such as "Type" or "Colours".
export const GalleryGroup = ({title, children}) => <div className="m-gallery__group"><h3 className="m-gallery__subheading">{title}</h3>{children}</div>;

// One example with its caption underneath.
export const Specimen = ({caption, children}) => <figure className="m-gallery__specimen"><div className="m-gallery__stage">{children}</div><figcaption className="m-gallery__caption">{caption}</figcaption></figure>;
