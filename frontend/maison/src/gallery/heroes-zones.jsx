// Climate's heroes in the gallery (#29 step 3): the zone capsules with
// the house heating running, switched off (the house's capsule alone loses
// its tick), and every sensor unavailable, each at phone size and, from a
// 1,240px gallery, at desktop size. C2 owns it after wave 0.
import {HERO_VARIANTS, heroSnapshot} from '../gallery-snapshots.js';
import {HeroSpecimen} from './heroes.jsx';

// Each HERO_VARIANTS.climate variant's caption.
const CAPTIONS = {running: 'Heating running', 'heating-off': 'Heating off', unavailable: 'Sensors unavailable'};

export function ZonesHeroes() {
  return <div className="m-gallery-heroes">
    {['phone', 'desktop'].flatMap(size => HERO_VARIANTS.climate.map(id =>
      <HeroSpecimen key={`${size}-${id}`} snapshot={heroSnapshot('climate', id)} size={size} caption={CAPTIONS[id] ?? id}/>))}
  </div>;
}
