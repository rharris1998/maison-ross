// The widgets section of the gallery (#29 step 4), the eleventh, after
// the frames so the earlier sections' baselines never move: the widget sizes,
// the grids and the phone stack (widget-specimens.jsx), then the parts the
// widgets are drawn with, in every state (part-specimens.jsx). Presses act on
// nothing.
import {GallerySection} from './section.jsx';
import {WidgetSpecimens, widgetSpecimensStyles} from './widget-specimens.jsx';
import {PartSpecimens, partSpecimensStyles} from './part-specimens.jsx';

export function WidgetsSection() {
  return <GallerySection name="widgets" title="Widgets and parts" note="The widgets Today is composed of, in each size and grid, and the parts they draw with, in every state">
    <WidgetSpecimens/><PartSpecimens/>
  </GallerySection>;
}

export const widgetsGalleryStyles = widgetSpecimensStyles + partSpecimensStyles;
