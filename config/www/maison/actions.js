// Derive observable outcomes for the small set of controls Maison owns.
// A successful service response alone never confirms a device changed state.
import {available,numeric} from './model.js?v=38';
export function expectedOutcome(domain,service,data={}) {
  const near=(a,b,tolerance=.05)=>numeric(a)!==null&&Math.abs(Number(a)-b)<=tolerance;
  if(domain==='input_boolean'&&['turn_on','turn_off'].includes(service))return state=>available(state)&&state.state===(service==='turn_on'?'on':'off');
  if(['input_number','number'].includes(domain)&&service==='set_value')return state=>available(state)&&near(state.state,Number(data.value));
  if(domain==='climate'&&service==='set_temperature')return state=>available(state)&&near(state.attributes?.temperature,Number(data.temperature));
  if(domain==='vacuum'&&['start','pause','return_to_base'].includes(service))return state=>available(state)&&(service==='start'?state.state==='cleaning':service==='pause'?state.state==='paused':['returning','docked'].includes(state.state));
  return null;
}
