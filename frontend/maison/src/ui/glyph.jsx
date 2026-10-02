import {icon} from '../../../../config/www/maison/icons.js';

// One of Maison's icons, decorative: the control around it carries the name.
// It is 1em square; a control sizes it with width and height, never a font size.
export const Glyph = ({name, className}) =>
  <span className={className ? `m-glyph ${className}` : 'm-glyph'} aria-hidden="true" dangerouslySetInnerHTML={{__html: icon(name)}}/>;
