import '/maison/maison-dashboard.js';

const card=document.querySelector('maison-dashboard');
// Regression fixture for HA's slotted shadow-root ancestry and inner scroller.
// Use ?host=slotted to exercise overlays outside the standalone document layout.
if(new URLSearchParams(location.search).get('host')==='slotted'){
 const shell=document.createElement('maison-preview-shell');
 const shellRoot=shell.attachShadow({mode:'open'});
 shellRoot.innerHTML='<style>:host{display:block;height:calc(100dvh - 80px)}.ha-view{height:100%;overflow:auto;overscroll-behavior:contain}</style><div class="ha-view"><slot></slot></div>';
 const panel=document.createElement('maison-preview-panel');
 panel.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block}</style><slot></slot>';
 card.replaceWith(shell);shell.append(panel);panel.append(card);
}
const payload=await(await fetch('/states.json')).json();
const registry=await(await fetch('/registry.json')).json();
let states=payload.states;
let behavior='confirm',sampleData=false;
const timers=new Set();
const source=document.querySelector('#source');
source.textContent=payload.source;

// Native cards require HA's authenticated frontend; show explicit
// placeholders, as Maison's footnote in the card's frame, as the gallery does.
window.loadCardHelpers=async()=>({createCardElement(config){
 const note=document.createElement('p');note.className='note';
 note.textContent=`${config.type.replaceAll('-',' ')} · Home Assistant control · available in the installed dashboard`;
 return note;
}});

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timestamp=()=>new Date().toISOString();
function replaceState(id,update){
 const current=states[id];if(!current)return;
 const next=update({...current,attributes:{...(current.attributes||{})}});
 const now=timestamp();
 states={...states,[id]:{...next,last_changed:now,last_updated:now,last_reported:now}};
 hass={...hass,states};card.hass=hass;
}
// The Climate scripts (#22–#26), as their watched entities would report them
// once Home Assistant and the thermostat have acted. Preview memory only.
const HOUSE='sensor.house_heating';
const ZONE={attic:['sensor.attic_target_temperature','schedule.attic_occupied','input_number.attic_comfort_temperature','input_number.attic_setback_temperature'],
 sams_office:['sensor.sams_office_target_temperature','schedule.sams_office_occupied','input_number.sams_office_comfort_temperature','input_number.sams_office_setback_temperature']};
const RAIL={ensuite:'binary_sensor.ensuite_towel_rail_drying',bathroom:'binary_sensor.bathroom_towel_rail_drying'};
let houseBefore=null;
const minute=value=>{const ms=Date.parse(value);return Number.isFinite(ms)?new Date(Math.floor(ms/60000)*60000).toISOString():null;};
function simulateClimate(script,variables={}){
 const name=script.replace(/^script\./,''),house=states[HOUSE];
 const hold=temperature=>replaceState(HOUSE,state=>{
  if(state.state!=='override'&&state.state!=='off')houseBefore={state:state.state,target:state.attributes.target};
  const off=state.state==='off';
  Object.assign(state.attributes,{override_temperature:Number(temperature),override_until:minute(variables.until),target:off?null:Number(temperature)});
  state.state=off?'off':'override';return state;});
 const restore=keys=>replaceState(HOUSE,state=>{
  for(const key of keys)state.attributes[key]=null;
  state.state=houseBefore?.state||'schedule';state.attributes.target=houseBefore?.target??state.attributes.day_temperature??null;houseBefore=null;return state;});
 if(name==='house_heating_override_set'&&house)return hold(variables.temperature);
 if(name==='house_heating_warm_until'&&house)return hold(house.attributes.day_temperature);
 if(name==='house_heating_override_cancel'&&house)return restore(['override_temperature','override_until']);
 if(name==='house_heating_away_set'&&house)return replaceState(HOUSE,state=>{
  houseBefore={state:state.state,target:state.attributes.target};
  Object.assign(state.attributes,{target:10,away_from:new Date().toISOString(),away_until:minute(variables.until),calling:false});state.state='away';return state;});
 if(name==='house_heating_away_cancel'&&house)return restore(['away_from','away_until']);
 const zone=ZONE[variables.zone];
 if(name==='heating_zone_override'&&zone)return replaceState(zone[0],state=>{
  const end=states[zone[1]]?.attributes?.next_event||null;
  state.state=String(variables.temperature);Object.assign(state.attributes,{mode:'override',override_until:end,next_change:end});return state;});
 if(name==='heating_zone_override_cancel'&&zone)return replaceState(zone[0],state=>{
  const occupied=states[zone[1]]?.state==='on',end=states[zone[1]]?.attributes?.next_event||null;
  state.state=String(states[occupied?zone[2]:zone[3]]?.state??state.state);Object.assign(state.attributes,{mode:occupied?'comfort':'setback',override_until:null,next_change:end});return state;});
 const rail=RAIL[variables.rail];
 if(name==='towel_rail_drying_start'&&rail)return replaceState(rail,state=>{state.state='on';state.attributes.until=new Date(Date.now()+3600000).toISOString();return state;});
 if(name==='towel_rail_drying_stop'&&rail)return replaceState(rail,state=>{state.state='off';state.attributes.until=null;return state;});
}
function simulate(domain,service,data){
 const id=data?.entity_id;
 if(domain==='script'&&service==='turn_on'&&/^script\.(house_heating|heating_zone_override|towel_rail_drying)/.test(id||''))return simulateClimate(id,data.variables);
 replaceState(id,state=>{
  if(domain==='input_boolean'&&['turn_on','turn_off'].includes(service))state.state=service==='turn_on'?'on':'off';
  if(domain==='input_number'&&service==='set_value')state.state=String(data.value);
  if(domain==='climate'&&service==='set_temperature')state.attributes.temperature=Number(data.temperature);
  if(domain==='climate'&&service==='set_hvac_mode'&&data.hvac_mode)state.state=String(data.hvac_mode);
  if(domain==='climate'&&service==='set_preset_mode'&&data.preset_mode)state.attributes.preset_mode=String(data.preset_mode);
  if(domain==='climate'&&service==='set_fan_mode'&&data.fan_mode)state.attributes.fan_mode=String(data.fan_mode);
  return state;
 });
}
function hash(value){let result=0;for(const char of value)result=(result*31+char.charCodeAt(0))>>>0;return result;}
function sampleHistory(path){
 const url=new URL('/'+path,'http://preview');
 const ids=(url.searchParams.get('filter_entity_id')||'').split(',').filter(Boolean);
 const encodedStart=path.match(/^history\/period\/([^?]+)/)?.[1];
 const start=new Date(encodedStart?decodeURIComponent(encodedStart):Date.now()-86400000).getTime();
 const end=new Date(url.searchParams.get('end_time')||Date.now()).getTime();
 return ids.map(id=>Array.from({length:7},(_,index)=>{
  const unit=states[id]?.attributes?.unit_of_measurement;
  const base=/°/.test(unit||'')?19:/%/.test(unit||'')?45:/kw/i.test(unit||'')?.7:220;
  const amplitude=/°/.test(unit||'')?2:/%/.test(unit||'')?8:/kw/i.test(unit||'')?.5:180;
  const value=base+Math.sin((index+hash(id)%7)/2)*amplitude;
  return {entity_id:index===0?id:undefined,state:index===3?'unavailable':String(Number(value.toFixed(2))),last_changed:new Date(start+(end-start)*index/6).toISOString()};
 }));
}
// A snapshot has no schedule configuration: the sample week is weekdays
// 08:00–18:00, weekends 10:00–20:00, for every schedule helper.
function sampleSchedule(id){
 const day=(from,to)=>[{from:`${from}:00`,to:`${to}:00`}],weekday=day('08:00','18:00'),weekend=day('10:00','20:00');
 return {response:{[id]:{monday:weekday,tuesday:weekday,wednesday:weekday,thursday:weekday,friday:weekday,saturday:weekend,sunday:weekend}}};
}
function sampleCalendar(path){
 const id=decodeURIComponent(path.match(/^calendars\/([^?]+)/)?.[1]||'calendar.preview');
 const url=new URL('/'+path,'http://preview');
 const start=new Date(url.searchParams.get('start')||Date.now());
 const offset=hash(id)%4;
 const eventStart=new Date(start.getTime()+(offset*24+10)*3600000);
 return [{summary:'Sample · household event',description:'Simulated preview data',location:'Simulated preview',start:{dateTime:eventStart.toISOString()},end:{dateTime:new Date(eventStart.getTime()+3600000).toISOString()}}];
}

let hass={
 states,connected:true,config:{time_zone:'Europe/Brussels',unit_system:{temperature:'°C'}},user:{name:'Alex'},themes:{darkMode:false},
 callWS:async request=>{
  if(request.type==='config/area_registry/list')return registry.areas;
  if(request.type==='config/device_registry/list')return registry.devices;
  if(request.type==='config/entity_registry/list')return registry.entities;
  if(request.type==='call_service'&&request.domain==='weather')return {response:{}};
  if(request.type==='call_service'&&request.domain==='schedule'&&request.service==='get_schedule')return sampleData?sampleSchedule(request.target?.entity_id):{response:{}};
  return {};
 },
 callApi:async(method,path)=>{
  if(method!=='GET')throw new Error('Preview API is read-only');
  if(path.startsWith('history/period/'))return sampleData?sampleHistory(path):[];
  if(path.startsWith('calendars/'))return sampleData?sampleCalendar(path):[];
  throw new Error('Preview API route unavailable');
 },
 callService:async(domain,service,data)=>{
  if(behavior==='fail'){await delay(150);throw new Error('Simulated device rejection');}
  const wait=behavior==='delay'?15000:1000;
  const timer=setTimeout(()=>{timers.delete(timer);simulate(domain,service,data);card.toast('Simulated state update · no device command sent');},wait);
  timers.add(timer);
 },
};

// Maison's card config, as the dashboard's YAML has it. A ?design left in a
// URL changes nothing: Maison has one design.
card.setConfig({type:'custom:maison-dashboard'});card.hass=hass;
document.querySelector('#theme').onchange=event=>{hass={...hass,themes:{darkMode:event.target.value==='dark'}};card.hass=hass;};
document.querySelector('#connection').onchange=event=>{hass={...hass,connected:event.target.value==='online'};card.hass=hass;};
document.querySelector('#behavior').onchange=event=>{behavior=event.target.value;};
document.querySelector('#data-mode').onchange=event=>{
 sampleData=event.target.value==='sample';
 source.textContent=sampleData?`${payload.source} · Simulated sample history and agenda`:payload.source;
 card._agendaTime=0;card._historyTimes={};card._historyPages={};card._agenda={events:[],errors:{},status:{}};card._history={series:{},errors:{}};card._scheduleTimes={};card._schedules={};
 card.loadViewData();card.render();
};
card.addEventListener('hass-more-info',event=>card.toast('Preview · '+event.detail.entityId));
window.addEventListener('pagehide',()=>{for(const timer of timers)clearTimeout(timer);});
