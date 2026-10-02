// Today's heroes in the gallery (#29 step 3): the weather by day, at
// night, and unavailable, each over its own sky (gallery-snapshots.js's
// HEROES), as a phone and, from a 1,240px gallery, on desktop. C1 owns it.
import {HERO_VARIANTS, heroSnapshot} from '../gallery-snapshots.js';
import {HeroSpecimen} from './heroes.jsx';

// Each HERO_VARIANTS id's caption.
const CAPTIONS = {day: 'Day', night: 'Night', unavailable: 'Weather unavailable'};

export function WeatherHeroes() {
  return <div className="m-gallery-heroes">
    {HERO_VARIANTS.today.map(id => <HeroSpecimen key={id} snapshot={heroSnapshot('today', id)} size="phone" caption={CAPTIONS[id] ?? id}/>)}
    {HERO_VARIANTS.today.map(id => <HeroSpecimen key={`${id}-desktop`} snapshot={heroSnapshot('today', id)} size="desktop" caption={`${CAPTIONS[id] ?? id}, on desktop`}/>)}
  </div>;
}
