// The details section of the gallery (#29 step 4, v32), the twelfth,
// after the widgets so the earlier sections' baselines never move: the parts
// Climate's page and sheets are drawn with, in every state
// (detail-specimens.jsx), then the 24-hour chart in each of its states
// (chart-specimens.jsx). Presses act on nothing.
import {GallerySection} from './section.jsx';
import {DetailSpecimens, detailSpecimensStyles} from './detail-specimens.jsx';
import {ChartSpecimens, chartSpecimensStyles} from './chart-specimens.jsx';

export function DetailsSection() {
  return <GallerySection name="details" title="Sheet parts and charts" note="The parts Climate’s page and sheets are drawn with, in every state, and the 24-hour chart">
    <DetailSpecimens/><ChartSpecimens/>
  </GallerySection>;
}

export const detailsGalleryStyles = detailSpecimensStyles + chartSpecimensStyles;
