// Energy's heroes in the gallery (#29 step 3): the flows at night on
// the grid while the Car charges off-peak and solar sleeps, at midday
// exporting while the Car charges from solar, and with every reading
// unavailable, each at phone size and, from a 1,240px gallery, at desktop
// size, where the price shows. C2 owns it after wave 0.
import {HERO_VARIANTS, heroSnapshot} from '../gallery-snapshots.js';
import {HeroSpecimen} from './heroes.jsx';

// Each HERO_VARIANTS.energy variant's caption.
const CAPTIONS = {'night-grid': 'Night, on the grid, charging off-peak', 'solar-charging': 'Solar, exporting, charging from solar',
  unavailable: 'Readings unavailable'};

export function FlowsHeroes() {
  return <div className="m-gallery-heroes">
    {['phone', 'desktop'].flatMap(size => HERO_VARIANTS.energy.map(id =>
      <HeroSpecimen key={`${size}-${id}`} snapshot={heroSnapshot('energy', id)} size={size} caption={CAPTIONS[id] ?? id}/>))}
  </div>;
}
