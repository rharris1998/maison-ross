// Isolated localhost preview: no HA client, credentials, proxy or service route.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const repo=fileURLToPath(new URL('../',import.meta.url));
const args=name=>process.argv.flatMap((value,index)=>value===name&&process.argv[index+1]?[process.argv[index+1]]:[]);
const snapshots=args('--snapshot'),inventoryPath=args('--inventory')[0],port=Number(args('--port')[0]||8766);
const safeAttributes=new Set([
 'friendly_name','unit_of_measurement','device_class','state_class','temperature','current_temperature','humidity',
 'wind_speed','wind_speed_unit','hvac_action','min','max','step','restored','cap_eur','slack_eur',
 'binding','reason','supported_features','hvac_modes','min_temp','max_temp','target_temp_step','volume_level',
 'battery_level','percentage','position','current_position','is_volume_muted','temperature_unit','current_humidity',
 'target_temp_high','target_temp_low','preset_mode','preset_modes','fan_mode','fan_modes','swing_mode','swing_modes',
 // Car tab (#13): policy flags and times, confirmation times and counting start. No location coordinates.
 'vehicle_data_valid','verified_since','managed','charging_wanted','ready_reserve','reserve_conflict','next_offpeak',
 'solar_restart_after','economic_basis','confirmed_at','counting_since','last_reset',
 // Climate (#21): schedule changes, the house thermostat and zone contract (#22, #24), Drying (#26).
 'next_event','editable','target','next_change','mode','override_until','override_temperature','away_until',
 'day_temperature','room_temperature','calling','pump','needs_house_heat','until',
 // Climate controls (#22–#26): Away's start, the thermostat clock and week, a zone's next target.
 'away_from','clock_offset_s','week','next_target',
 // Maison's sky (#29 step 3): the sun's position and the weather's cloud cover.
 'elevation','azimuth','rising','cloud_coverage',
]);
// The modules that name entities outright, so the preview serves those states
// beside every sensor and binary sensor.
const sourceFiles=['model.js','maison-dashboard.js','actions.js','guard.js','screen.js','history.js','car.js','climate.js','today.js','energy.js','system.js','sky.js'];
const source=sourceFiles.map(name=>{try{return readFileSync(resolve(repo,'config/www/maison',name),'utf8');}catch{return '';}}).join('\n');
const explicitIds=new Set(source.match(/(?:climate|person|calendar|script|input_boolean|input_number|schedule|number|lock|switch|weather|vacuum|cover|update|device_tracker|input_text|sun)\.[a-z0-9_]+/g)||[]);

function rawStates(){
 const merged={};
 for(const path of snapshots){
  const raw=JSON.parse(readFileSync(resolve(path),'utf8'));
  for(const state of Object.values(raw.entities||raw))if(state?.entity_id)merged[state.entity_id]=state;
 }
 return merged;
}

function states(){
 const raw=rawStates();
 const selected=Object.values(raw).filter(state=>/^(sensor|binary_sensor)\./.test(state.entity_id)||explicitIds.has(state.entity_id));
 return Object.fromEntries(selected.map(state=>{
  const attributes={};
  for(const [key,value] of Object.entries(state.attributes||{}))if(safeAttributes.has(key))attributes[key]=value;
  return [state.entity_id,{
   entity_id:state.entity_id,state:state.state,attributes,
   ...(state.last_changed?{last_changed:state.last_changed}:{}),
   ...(state.last_updated?{last_updated:state.last_updated}:{}),
   ...(state.last_reported?{last_reported:state.last_reported}:{}),
  }];
 }));
}

function registry(){
 if(!inventoryPath)return {areas:[],devices:[],entities:[]};
 const raw=JSON.parse(readFileSync(resolve(inventoryPath),'utf8'));
 const areas=(raw.areas||[]).map(area=>({
  area_id:area.area_id,name:area.name,floor_id:area.floor_id||null,
  temperature_entity_id:area.configured_temperature_entity_id||null,
  humidity_entity_id:area.configured_humidity_entity_id||null,
 }));
 const devices=new Map(),entities=new Map();
 for(const room of raw.rooms||[]){
  for(const item of Object.values(room.live||{})){
   const entry=item?.registry,id=entry?.entity_id;
   if(!id)continue;
   entities.set(id,{entity_id:id,...(entry.registry_device_id?{device_id:entry.registry_device_id}:{}),...(entry.registry_area_id?{area_id:entry.registry_area_id}:{})});
   if(entry.registry_device_id&&!devices.has(entry.registry_device_id))devices.set(entry.registry_device_id,{
    id:entry.registry_device_id,area_id:entry.device_area_id||null,name:entry.device_name||null,
   });
  }
 }
 return {areas,devices:[...devices.values()],entities:[...entities.values()]};
}

const routes=new Map([
 ['/','dev/maison/index.html'],['/gallery','dev/maison/gallery.html'],
 ...['preview.js','preview.css'].map(name=>['/dev/'+name,'dev/maison/'+name]),
 ...['maison-dashboard.js','model.js','styles.js','icons.js','data.js','actions.js','guard.js','screen.js','history.js','car.js','climate.js','today.js','energy.js','system.js','sky.js','vendor/maison-react.js','vendor/maison-gallery.js'].map(name=>['/maison/'+name,'config/www/maison/'+name]),
]);

http.createServer((req,res)=>{
 try{
  // Prevent a remote website from reaching a private snapshot through rebinding.
  if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`){res.writeHead(403);res.end();return;}
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  const path=new URL(req.url,'http://localhost').pathname;
  let data,type;
  if(path==='/states.json'){
   data=JSON.stringify({states:states(),source:snapshots.length?'Private sanitized snapshot · controls simulated':'No snapshot · unavailable-state preview'});type='application/json';
  }else if(path==='/registry.json'){
   data=JSON.stringify(registry());type='application/json';
  }else if(routes.has(path)){
   const file=routes.get(path);data=readFileSync(resolve(repo,file));type=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript';
  }else{res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(data);
 }catch{res.writeHead(500);res.end('Preview unavailable');}
}).listen(port,'127.0.0.1',()=>console.log(`Maison preview: http://127.0.0.1:${port} · gallery: /gallery`));
