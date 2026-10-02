import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {numeric,power,binDay,alerts,E,ZONES,HOUSE,TOWEL_RAILS,CLIMATE_CONTRACT,REGISTERS,COSTS,CALENDARS,ledger} from '../config/www/maison/model.js';
import {CLIMATE_DETAILS} from '../config/www/maison/climate.js';
import {ENERGY_DETAILS} from '../config/www/maison/energy.js';
import {CAR_DETAILS} from '../config/www/maison/car.js';
import {historyChart,dayWindow} from '../config/www/maison/history.js';
import {screen,control,link,controls,words,historyDefinition} from '../config/www/maison/screen.js';
import {WRITE_COMMANDS} from '../config/www/maison/guard.js';
import {styles} from '../config/www/maison/styles.js';
import {expectedOutcome} from '../config/www/maison/actions.js';
import {icon,iconNames} from '../config/www/maison/icons.js';
import {fixtureSnapshot} from '../frontend/maison/fixtures/fixture-snapshot.js';
import {CLIMATE_FIXTURES} from '../frontend/maison/fixtures/climate-fixtures.js';
import {LIGHT,DARK} from '../frontend/maison/src/ui/tokens.js';
import {HOME_FIXTURES,HOME_NOW} from '../frontend/maison/fixtures/home-fixtures.js';
const registered=new Map();
// Enough of an element to construct Maison: a shadow root to write its loading
// shell into, and the listeners it puts on itself, by type.
globalThis.HTMLElement=class {attachShadow(){this.shadowRoot={};return this.shadowRoot;}addEventListener(type,listener){(this.listeners||={})[type]=listener;}};
globalThis.customElements={get:key=>registered.get(key),define:(key,value)=>registered.set(key,value)};
globalThis.window={customCards:[]};
await import('../config/www/maison/maison-dashboard.js');
const Maison=registered.get('maison-dashboard');
const state=(state,attributes={})=>({state,attributes});
function harness(states={},connected=true){
 const card=Object.create(Maison.prototype),calls=[],messages=[];
 card._hass={states,connected,callService:async(...args)=>calls.push(args)};
 card._busy=new Set();card.render=()=>{};card.toast=m=>messages.push(m);
 return {card,calls,messages};
}
// A press reaches the element as an intent (#27).
const press=(card,command,entity,extras={})=>card.command({command,entity,...extras});
// Whether the card draws a control for `intent` enabled, as screen.js's kit decides it from the element's snapshot.
const enabled=(card,intent)=>(WRITE_COMMANDS.has(intent.command)?control:link)(intent,card.snapshot()).enabled;
test('missing readings are never converted to zero or healthy readings',()=>{
 for(const value of ['unavailable','unknown','',null,undefined,'NaN']){assert.equal(numeric(value),null);assert.equal(power(value),'—');}
 assert.equal(numeric('0'),0);assert.equal(power('-2300'),'2.30 kW');assert.equal(power('0.5','kW'),'500 W');
 assert.equal(binDay('unknown'),'Date unavailable');assert.equal(binDay('0'),'Today');assert.equal(binDay('1'),'Tomorrow');
});
test('lighting belongs to the Hue app: the model has no light, scene or lighting-routine entities',()=>{
 const ids=JSON.stringify({E,ZONES,HOUSE,TOWEL_RAILS,CLIMATE_CONTRACT}).match(/"[a-z_]+\.[a-z0-9_]+"/g).map(id=>id.slice(1,-1));
 assert.deepEqual(ids.filter(id=>['light','scene'].includes(id.split('.')[0])||id.includes('adaptive')),[]);
 const values=Object.values(E).flat();
 assert.deepEqual(values.filter(id=>id.startsWith('script.')).sort(),[E.carAutomatic,E.carNow,E.carRefresh].sort(),'only the charging scripts remain');
 assert.deepEqual(values.filter(id=>id.startsWith('input_boolean.')).sort(),[E.carOverride,E.carSmart,E.heatingAuto].sort(),'no lighting helpers remain');
});
test('unknown maintenance values and sleeping solar never create a false fault',()=>{
 assert.deepEqual(alerts({'sensor.roborock_s8_pro_ultra_filter_time_left':state('unavailable'),[E.solar]:state('unavailable')}),[]);
 assert.equal(alerts({'sensor.roborock_s8_pro_ultra_filter_time_left':state('-1')})[0].title,'Vacuum filter needs cleaning');
});
test('a rate card about to run out asks for the new rates',()=>{
 const id='binary_sensor.rate_card_ends_within_30_days';
 assert.deepEqual(alerts({[id]:state('off')}),[]);
 assert.deepEqual(alerts({[id]:state('on')}).map(a=>[a.title,a.entity]),[['Rate card needs new rates',id]]);
});
// React escapes what it draws (#27), so values carry names and calendar
// contents as Home Assistant gives them, never as escaped markup.
test('entity labels and calendar contents are raw text in what the element shows',()=>{
 const odd='sensor.odd',{card}=harness({[odd]:{entity_id:odd,state:'3',attributes:{friendly_name:'<script>alert(1)</script> & co'}}});
 card._hass.config={time_zone:'Europe/Brussels'};card._page='system';
 const shown=words(screen(card.snapshot()).page);
 assert.ok(shown.includes('<script>alert(1)</script> & co'),'the sensor’s name as named');
 assert.ok(!shown.some(line=>/&lt;|&gt;|&amp;/.test(line)));
 card._page='today';card._dialog={kind:'event',event:{summary:'<img src=x onerror="run()">',location:'School & gym',startMs:Date.parse('2026-09-16T08:00:00Z'),endMs:Date.parse('2026-09-16T09:00:00Z'),allDay:false,partial:false,calendarId:'calendar.kids'}};
 const {dialog}=screen(card.snapshot());
 assert.deepEqual([dialog.title,dialog.location],['<img src=x onerror="run()">','School & gym']);
});
test('switch actions use the explicit input_boolean domain and refuse other domains',async()=>{
 const others=['light','switch','script'].map(domain=>`${domain}.office`);
 const {card,calls}=harness({[E.heatingAuto]:state('off'),...Object.fromEntries(others.map(id=>[id,state('off')]))});
 for(const id of others)await press(card,'toggle',id);
 assert.equal(calls.length,0);
 await press(card,'toggle',E.heatingAuto);
 assert.deepEqual(calls,[['input_boolean','turn_on',{entity_id:E.heatingAuto}]]);
});
test('lighting entrypoints are gone: brightness, colour and scene requests dispatch nothing',async()=>{
 const [lamp,scene]=['light','scene'].map(domain=>`${domain}.office`);
 const {card,calls,messages}=harness({[lamp]:state('on'),[scene]:state('unknown')});
 await press(card,'brightness',lamp,{value:40});
 await press(card,'scene',scene,{roomId:'office'});await press(card,'lights-off',lamp);
 assert.equal(calls.length,0);assert.equal(messages.length,0);
 assert.equal(card.setLightColor,undefined);assert.equal(card.brightnessControl,undefined);
});
// The control is disabled, so the press is refused before service(): no call and no toast.
test('offline and unavailable devices do not dispatch actions',async()=>{
 for(const [s,online] of [['unavailable',true],['off',false]]){
  const {card,calls,messages}=harness({[E.heatingAuto]:state(s)},online);
  assert.equal(enabled(card,{command:'toggle',entity:E.heatingAuto}),false);
  await press(card,'toggle',E.heatingAuto);assert.equal(calls.length,0);assert.deepEqual(messages,[]);
 }
});
test('shared attic targets honor entity limits and do not write to an individual TRV',async()=>{
 const {card,calls}=harness({[E.atticComfort]:state('24',{min:16,max:24,step:.5})});
 await press(card,'step',E.atticComfort,{direction:1});
 assert.deepEqual(calls,[],'a step at the maximum is refused, as the card disables it');
 card.hass.states[E.atticComfort]=state('23.8',{min:16,max:24,step:.5});
 await press(card,'step',E.atticComfort,{direction:1});
 assert.deepEqual(calls,[['input_number','set_value',{value:24,entity_id:E.atticComfort}]]);
});
test('service failures are surfaced, not reported as success',async()=>{
 const {card,messages}=harness({[E.heatingAuto]:state('off')});
 card.hass.callService=async()=>{throw new Error('Device did not respond');};
 await press(card,'toggle',E.heatingAuto);
 assert.match(messages[0],/Could not complete.*Device did not respond/);assert.equal(card._busy.size,0);
});
test('duplicate in-flight control actions are suppressed',async()=>{
 const {card,calls}=harness({[E.heatingAuto]:state('off')});
 let finish;card.hass.callService=(...args)=>{calls.push(args);return new Promise(resolve=>finish=resolve);};
 const first=press(card,'toggle',E.heatingAuto);await press(card,'toggle',E.heatingAuto);finish();await first;
 assert.equal(calls.length,1);
});
test('vacuum command names are restricted',async()=>{
 const {card,calls}=harness({[E.vacuum]:state('docked')});
 await press(card,'vacuum','delete');assert.equal(calls.length,0);
 await press(card,'vacuum','start');
 assert.deepEqual(calls[0],['vacuum','start',{entity_id:E.vacuum}]);
});
test('service acknowledgement waits for observed state before claiming confirmation',async()=>{
 const id=E.heatingAuto, {card}=harness({[id]:state('off')});
 await press(card,'toggle',id);
 assert.match(card._actionStatus,/waiting for device update/);assert.ok(card._busy.has(id));
 card.reconcileActions();assert.match(card._actionStatus,/waiting/);
 card.hass.states[id]=state('on');card.reconcileActions();
 assert.match(card._actionStatus,/confirmed by Home Assistant/);assert.equal(card._busy.size,0);
});
test('outcomes require the observed state or attribute, and only for owned domains',()=>{
 assert.equal(expectedOutcome('input_boolean','turn_on')(state('off')),false);
 assert.equal(expectedOutcome('input_boolean','turn_on')(state('on')),true);
 assert.equal(expectedOutcome('input_boolean','turn_off')(state('unavailable')),false);
 for(const service of ['media_play','media_pause','volume_set'])assert.equal(expectedOutcome('media_player',service,{volume_level:.4}),null,'the players left with Life (v35)');
 assert.equal(expectedOutcome('light','turn_on',{brightness_pct:80}),null,'lighting is no longer a Maison control');
 assert.equal(expectedOutcome('script','turn_on'),null);
});
test('the players left with Life (v35): a media press dispatches nothing',async()=>{
 const id='media_player.tv_tv',{card,calls}=harness({[id]:state('playing',{supported_features:16389,volume_level:.3})});
 for(const command of ['media-toggle','media-volume'])await press(card,command,id,{value:40});
 assert.deepEqual(calls,[]);
});
test('sensor catalog includes unavailable and zero readings, with names as named',()=>{
 const id='sensor.humidity', {card}=harness({[id]:{entity_id:id,state:'0',attributes:{device_class:'humidity',unit_of_measurement:'%',friendly_name:'<script>bad</script>'}},'sensor.missing':{entity_id:'sensor.missing',state:'unavailable',attributes:{}}});
 card._page='system';
 const {rows,summary}=screen(card.snapshot()).page.sensors;
 assert.equal(summary,'2 matching readings · 1 unavailable');
 assert.deepEqual(rows.map(r=>[r.title,r.value,r.unavailable]),[['<script>bad</script>','0\u00a0%',false],['sensor.missing','Unavailable',true]]);
});
test('all climate and navigation icons use a local attributed set with no generic home fallback',()=>{
 for(const detail of CLIMATE_DETAILS)assert.ok(iconNames.includes(detail.icon),detail.id);
 for(const name of ['home','climate','car','energy','life'])assert.ok(iconNames.includes(name),name);
 assert.match(icon('home'),/gravity-ui:house/);assert.match(icon('sofa'),/lucide:sofa/);
 assert.doesNotMatch(icon('home'),/https?:|<script/);assert.match(icon('missing'),/circle-info/);
});
// The element remembers the events a render drew, so an agenda event opens
// what the viewer saw even when a refresh lands before the next render.
test('a background agenda refresh cannot change which drawn event opens',async()=>{
 const soon=Date.now()+3600000,{card}=harness({}),screens=[],clicked={summary:'The event I clicked',calendarId:'calendar.kids',startMs:soon,endMs:soon+3600000,allDay:false,partial:false};
 delete card.render;card._config={};card._hass.config={time_zone:'Europe/Brussels'};card._react={update:s=>screens.push(s)};card._page='today';
 card._agenda={events:[clicked],errors:{},status:{}};card.render();
 assert.deepEqual(screens[0].page.upcoming.rows.map(e=>[e.title,e.link.intent]),[['The event I clicked',{command:'agenda-event',entity:'0'}]]);
 card._agenda={events:[{...clicked,summary:'Newly inserted event'}],errors:{},status:{}};
 await press(card,'agenda-event','0');
 assert.deepEqual(card._dialog,{kind:'event',event:clicked});
 assert.deepEqual([screens.at(-1).dialog.kind,screens.at(-1).dialog.title],['event','The event I clicked'],'the next render shows it');
 for(const entity of ['1','-1','x',undefined]){card._dialog=null;await press(card,'agenda-event',entity);assert.equal(card._dialog,null,String(entity));}
});
test('history error and period belong to each cache group, never the last page fetched',()=>{
 const {card}=harness({'sensor.office_sensor_temperature':state('19.8',{unit_of_measurement:'°C'})}),today=dayWindow(Date.now(),card.zone()).start;
 card._historyPages={energy:{data:{series:{},errors:{history:'Recorder failed'}},start:today,end:today+1},'climate-attic':{data:{series:{},errors:{}},start:3,end:4}};
 const snap=card.snapshot(),chart=key=>historyChart(snap,historyDefinition(snap.states,key));
 assert.equal(historyDefinition(snap.states,'power').group,'energy');
 assert.equal(historyDefinition(snap.states,'climate-attic-temperature').group,'climate-attic');
 assert.equal(chart('power').status,'error');
 assert.equal(chart('climate-attic-temperature').status,'empty');
 card._page='energy';
 const {model,action}=screen(card.snapshot()).page.dayChart;
 assert.deepEqual([model.status,action.intent],['error',{command:'detail',entity:'energy-today'}]);
 // Full history is the Energy today sheet's, under the same group's definition.
 card._modal='energy-today';
 assert.deepEqual(screen(card.snapshot()).drawer.body.links.map(l=>l.intent),[{command:'native-history',entity:'power'}]);
});

// ---- Money layer ---------------------------------------------------------
test('a register ledger nets import against export and never guesses a meter',()=>{
 const [peak]=REGISTERS;
 assert.equal(ledger({},peak),null,'no meters at all');
 assert.equal(ledger({[peak.imported]:state('162.471')},peak),null,'export meter missing');
 assert.equal(ledger({[peak.imported]:state('162.471'),[peak.exported]:state('unavailable')},peak),null);
 const l=ledger({[peak.imported]:state('162.471'),[peak.exported]:state('192.920'),
  [peak.reserve]:state('30.449'),[peak.billable]:state('0.0')},peak);
 assert.equal(l.imported,162.471);assert.equal(l.exported,192.920);
 assert.equal(l.covered,true);assert.equal(l.scale,192.920);
});
test('a register that has started billing is not reported as covered',()=>{
 const [,off]=REGISTERS;
 const l=ledger({[off.imported]:state('900'),[off.exported]:state('384'),
  [off.reserve]:state('0'),[off.billable]:state('516')},off);
 assert.equal(l.covered,false);assert.equal(l.billable,516);assert.equal(l.scale,900);
});
test('an unreadable compensation sensor is unknown, not covered',()=>{
 const [peak]=REGISTERS;
 const l=ledger({[peak.imported]:state('10'),[peak.exported]:state('20'),
  [peak.reserve]:state('unknown'),[peak.billable]:state('unavailable')},peak);
 assert.equal(l.covered,null,'no billable reading means no verdict');
});
test('zero meters produce a usable scale rather than a division by zero',()=>{
 const [peak]=REGISTERS;
 const l=ledger({[peak.imported]:state('0'),[peak.exported]:state('0'),[peak.billable]:state('0')},peak);
 assert.equal(l.scale,1);assert.ok(Number.isFinite(l.imported/l.scale));
});
test('the money layer reads only entities that exist in the model',()=>{
 for(const r of REGISTERS) for(const key of ['imported','exported','reserve','billable','price'])
  assert.match(r[key],/^sensor\./,`${r.id}.${key}`);
 for(const [label,id] of COSTS){assert.match(id,/^sensor\.electricity_cost_/);assert.ok(!/[<>]/.test(label));}
 assert.equal(E.priceAllIn,'sensor.electricity_price_all_in');
 assert.equal(E.offPeakNow,'binary_sensor.electricity_off_peak_now');
});

// ---- Theme -----------------------------------------------------------------
test('the theme follows Home Assistant, falling back to the OS preference',()=>{
 const card=Object.create(Maison.prototype);const seen=[];
 card.toggleAttribute=(name,on)=>seen.push([name,on]);
 const os=matches=>{globalThis.window.matchMedia=()=>({matches});};
 os(false);
 card._hass={themes:{darkMode:true}};card.applyTheme();
 assert.deepEqual(seen.at(-1),['dark',true],'HA dark wins over a light OS');
 card._hass={themes:{darkMode:false}};card.applyTheme();
 assert.deepEqual(seen.at(-1),['dark',false],'HA light wins over the OS too');
 os(true);
 card._hass={};card.applyTheme();
 assert.deepEqual(seen.at(-1),['dark',true],'no HA theme yet falls back to the OS');
 os(false);
 card._hass=undefined;card.applyTheme();
 assert.deepEqual(seen.at(-1),['dark',false],'no hass at all is not a crash');
 delete globalThis.window.matchMedia;
 card.applyTheme();
 assert.deepEqual(seen.at(-1),['dark',false],'a host without matchMedia stays light');
});

// ---- The shell (ADR 0005) ---------------------------------------------------
// Enough of a document to build the shell's nodes: each node keeps its tag,
// class, text, attributes, children and listeners.
function shellDocument(){
 const make=tag=>({tag,className:'',textContent:'',innerHTML:'',attributes:{},children:[],listeners:{},
  setAttribute(name,value){this.attributes[name]=String(value);},append(...nodes){this.children.push(...nodes);},
  replaceChildren(...nodes){this.children=nodes;},addEventListener(type,listener){this.listeners[type]=listener;}});
 return {document:{createElement:make},wrap:make('div')};
}
// A node as [tag.class, text, attributes, children], what the shell draws.
const shape=node=>[`${node.tag}.${node.className}`,node.textContent,{...node.attributes,...(node.type&&{type:node.type})},node.children.map(shape)];
test('the shell is Maison’s own markup: the loading line, then the notice with its glyph, its title and Retry',()=>{
 globalThis.location={hash:'',pathname:'/maison-home/home',search:''};
 let card;try{card=new Maison();}finally{delete globalThis.location;}
 assert.equal(card.shadowRoot.innerHTML,`<style>${styles}</style><div class="wrap"><p class="m-loading" role="status">Loading Maison…</p></div>`,'the shadow root holds only styles.js and the loading line');
 const {document,wrap}=shellDocument();globalThis.document=document;
 try{
  card.shadowRoot={querySelector:selector=>selector==='.wrap'?wrap:null};
  card._load={state:'loading',attempt:0};card.showLoadState();
  assert.deepEqual(wrap.children.map(shape),[['p.m-loading','Loading Maison…',{role:'status'},[]]]);
  card._load={state:'failed',attempt:0};card.showLoadState();
  assert.deepEqual(wrap.children.map(shape),[['div.m-notice','',{role:'alert'},[
   ['span.m-notice__glyph','',{},[]],['p.m-notice__title','Maison couldn’t load. Reload to retry.',{},[]],['button.m-notice__retry','Retry',{type:'button'},[]]]]]);
  const [notice]=wrap.children,[glyph,,retry]=notice.children;
  assert.equal(glyph.innerHTML,icon('alert'),'the glyph is Maison’s alert icon');
  let retried=0;card.retryBundle=()=>retried++;retry.listeners.click();assert.equal(retried,1,'Retry imports again');
 }finally{delete globalThis.document;}
});
// Every rule of styles.js, as [selector, declarations], at-rules unwrapped.
const shellRules=()=>[...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([,selector,body])=>[selector.trim(),body]);
test('the shell’s sheet draws only the loading line and the notice, in one layer, and the host sets nothing the pages inherit',()=>{
 assert.match(styles.trim(),/^@layer maison-shell\{[^]*\}$/,'one layer, so any rule of the bundle beats it');
 assert.equal(styles.match(/@layer\b/g).length,1);
 const rules=shellRules();
 assert.ok(rules.length>5,'the reader finds the rules');
 for(const [selector] of rules)
  assert.match(selector,/^(?::host(?:\(\[dark\]\))?|(?:(?::host\(\[dark\]\) )?\.m-(?:loading|notice)[\w-]*(?: svg|:active)?(?:,|$))+)$/,selector);
 assert.ok(!rules.some(([selector])=>/\.wrap|design|\.native/.test(selector)),'no .wrap, design or Home Assistant card rule');
 // The host: a flow root as tall as Home Assistant's view, with a background, and nothing that inherits.
 for(const [selector,body] of rules.filter(([selector])=>selector.startsWith(':host')&&!selector.includes('.m-')))
  assert.deepEqual(body.split(';').map(d=>d.split(':')[0]).filter(p=>!['display','min-height','background'].includes(p)),[],selector);
 // No variable but the shell's own: neither HeroUI's nor Home Assistant's theme.
 for(const [,name] of styles.matchAll(/var\((--[\w-]+)/g))assert.match(name,/^--shell-[\w-]+$/,name);
 // Maison's own colours, as ui/tokens.js has them, so the shell looks like the page that replaces it.
 const rule=selector=>rules.find(([s])=>s===selector)?.[1]??'';
 const value=(selector,property)=>rule(selector).split(';').find(d=>d.startsWith(property+':'))?.slice(property.length+1);
 for(const [theme,host,shell,tokens,card] of [['light',':host','.m-loading,.m-notice',LIGHT,LIGHT['m-card-fill']],['dark',':host([dark])',':host([dark]) .m-loading,:host([dark]) .m-notice',DARK,'#1C1C1E']]){
  assert.equal(value(host,'background'),tokens['m-bg'],`${theme} page`);
  assert.deepEqual(['--shell-card','--shell-label','--shell-label-2','--shell-fill','--shell-fill-pressed','--shell-orange'].map(name=>value(shell,name)),
   [card,tokens['m-label'],tokens['m-label-2'],tokens['m-fill-gray'],tokens['m-fill-pressed'],tokens['m-orange-text']],theme);
 }
 // The look: the line in gray at 17px, the notice a card with 24px corners, Retry a gray capsule at least 44px high.
 assert.match(rule('.m-loading'),/font:400 17px\/22px system-ui,[^;]*;color:var\(--shell-label-2\)/);
 assert.match(rule('.m-notice'),/border-radius:24px;background:var\(--shell-card\)/);
 assert.match(rule('.m-notice__retry'),/height:44px;.*border-radius:999px;background:var\(--shell-fill\)/);
 for(const theme of ['.m-loading,.m-notice',':host([dark]) .m-loading,:host([dark]) .m-notice'])
  assert.match(rule(theme),/--shell-fill:rgba\([^)]+\);--shell-fill-pressed:rgba/,theme);
});
test('helper switches carry their state and disable unavailable controls',()=>{
 for(const [value,connected,enabled] of [['on',true,true],['off',true,true],['unavailable',true,false],['on',false,false]]){
  const {card}=harness({[E.heatingAuto]:state(value)},connected);card._page='climate';card._modal='attic';
  const {heating}=screen(card.snapshot()).drawer.body.airco;
  assert.deepEqual([heating.kind,heating.control.ariaLabel,heating.control.selected,heating.control.enabled],['switch','Let the Airco heat when cheaper',value==='on',enabled],`${value} ${connected}`);
 }
});


test('drawer history requests are scoped and cached independently while concurrent responses finish',async()=>{
 const present=[HOUSE.temperature,HOUSE.humidity,...ZONES[0].valves.map(v=>v.id),ZONES[0].temperature,ZONES[0].humidity,ZONES[0].target];
 const {card}=harness(Object.fromEntries(present.map(id=>[id,state('20')])));card.scheduleRender=()=>{};const requests=[];
 card.hass.callApi=(_method,path)=>new Promise(resolve=>requests.push({path,resolve}));
 const house=card.detailHistory('house').flatMap(h=>h.ids),attic=card.detailHistory('attic').flatMap(h=>h.ids);
 const a=card.loadHistoryGroup('climate-house',house);
 const b=card.loadHistoryGroup('climate-attic',attic);
 await card.loadHistoryGroup('climate-house',[HOUSE.temperature]);
 assert.equal(requests.length,2);
 assert.match(decodeURIComponent(requests[0].path),/filter_entity_id=sensor.living_room_sensor_temperature,sensor.living_room_sensor_humidity&/);
 assert.doesNotMatch(requests[0].path,/office|roborock/);
 requests[1].resolve([]);await b;assert.ok(card._historyPages['climate-attic']);assert.ok(!card._historyPages['climate-house']);
 requests[0].resolve([]);await a;await card.loadHistoryGroup('climate-house',[HOUSE.temperature]);assert.equal(requests.length,2);
 assert.equal(card._historyRequests.size,0);
});
// v37: Energy's chart is today's, so its group loads from the house's
// midnight, kept five minutes as any group is, and loads again as soon as a
// new day starts rather than waiting the five minutes out.
test('Energy’s power loads from the house’s midnight, and again as soon as the day changes',async()=>{
 const {card}=harness({}),calls=[];card.scheduleRender=()=>{};
 card.loadHistoryGroup=(...args)=>calls.push(args);card._page='energy';
 await card.loadViewData();
 assert.deepEqual(calls.map(([key,,from])=>[key,from]),[['energy',dayWindow(Date.now(),card.zone()).start]]);
 delete card.loadHistoryGroup;
 const requests=[];card.hass.callApi=async(_method,path)=>{requests.push(decodeURIComponent(path));return [];};
 // Today's midnight by the test's own clock; then a cache from another
 // start, as yesterday's is once the day changes.
 const ids=['sensor.house_load_power'],today=dayWindow(Date.now(),card.zone()).start;
 await card.loadHistoryGroup('energy',ids,today);
 assert.ok(requests[0].startsWith(`history/period/${new Date(today).toISOString()}?end_time=`),'from that midnight');
 await card.loadHistoryGroup('energy',ids,today);
 assert.equal(requests.length,1,'kept five minutes');
 card._historyPages.energy.start=today-86400000;
 await card.loadHistoryGroup('energy',ids,today);
 assert.equal(requests.length,2,'a cache from another day loads again at once');
 assert.equal(card._historyPages.energy.start,today);
});
// Life left in v35 (#29): an old #life link, or one under it, lands on Today.
test('old Life links open Today',()=>{
 const {card}=harness({}),destinations=[];
 globalThis.history={replaceState:(_a,_b,url)=>destinations.push(url)};
 try{
  for(const hash of ['#life','#life/agenda']){globalThis.location={hash,pathname:'/maison-home/home',search:'?kiosk'};assert.equal(card.readPage(),'today',hash);}
  assert.deepEqual(destinations,['/maison-home/home?kiosk#today','/maison-home/home?kiosk#today']);
 }finally{delete globalThis.location;delete globalThis.history;}
});
// The calendar is read for Today only, the one page that draws it.
test('the agenda loads on Today only',async()=>{
 for(const page of ['today','climate','car','energy','system']){
  const {card}=harness({}),requests=[];card._hass.callApi=async(_method,path)=>{requests.push(path);return [];};
  card._page=page;card.scheduleRender=()=>{};card.loadHistoryGroup=()=>{};card.loadZoneSchedules=()=>{};
  await card.loadViewData();
  assert.equal(requests.length>0,page==='today',page);
 }
});
test('#climate is the page, with no redirect',()=>{
 const {card}=harness({});card._forecasts=[];
 globalThis.location={hash:'#climate',pathname:'/maison-home/home',search:''};let destination=null;
 globalThis.history={replaceState:(_a,_b,url)=>{destination=url;}};
 try{
  card._page=card.readPage();assert.equal(card._page,'climate');assert.equal(destination,null);
  const {page,drawer}=screen(card.snapshot());
  assert.equal(page.id,'climate');assert.equal(page.legacy,undefined,'React draws the Climate page from its value');assert.equal(drawer,null);
  for(const name of ['climatePage','detailView'])assert.equal(card[name],undefined,name);
 }
 finally{delete globalThis.location;delete globalThis.history;}
});

test('page navigation resets scrolling containers without aligning the card',async()=>{
 const {card}=harness({}),operations=[];
 const root={scrollTo:options=>operations.push(['document',options]),getRootNode:()=>({})};
 const haScroller={parentElement:root,scrollTo:options=>operations.push(['ha-view',options])};
 const slotWrapper={parentElement:null,getRootNode:()=>({host:haScroller}),scrollTo:options=>operations.push(['slotted-view',options])};
 const slot={parentElement:slotWrapper};
 const cardWrapper={assignedSlot:slot,parentElement:root,scrollTo:()=>{}};
 card.parentElement=cardWrapper;
 card.scrollIntoView=()=>assert.fail('card alignment must not move the surrounding page');
 card.render=()=>operations.push(['render',card._page]);
 card.loadViewData=()=>operations.push(['load',card._page]);
 globalThis.document={scrollingElement:root};
 globalThis.location={hash:'#today',pathname:'/maison-home/home',search:'?test=1'};
 globalThis.history={replaceState:(_a,_b,url)=>operations.push(['url',url])};
 try{
  await press(card,'navigate','climate');
  assert.equal(card._page,'climate');
  assert.deepEqual(operations[0],['url','/maison-home/home?test=1#climate']);
  assert.deepEqual(operations[1],['render','climate']);
  assert.ok(operations.some(([target,options])=>target==='ha-view'&&options.top===0&&options.behavior==='instant'));
  assert.ok(operations.some(([target,options])=>target==='slotted-view'&&options.top===0));
  assert.ok(operations.some(([target,options])=>target==='document'&&options.top===0));
  assert.deepEqual(operations.at(-1),['load','climate']);
  operations.length=0;await press(card,'navigate','unknown');assert.deepEqual(operations,[]);
 }finally{delete globalThis.document;delete globalThis.location;delete globalThis.history;}
});


test('the Rooms entrypoints and direct valve writes are gone',async()=>{
 const valid={supported_features:385,min_temp:4,max_temp:35,target_temp_step:.5,temperature:21};
 const {card,calls}=harness({'climate.bedroom_trv':state('heat',valid),[E.airco]:state('off',{hvac_modes:['off','heat']})});
 for(const name of ['setClimateMode','setClimateTarget','setHelperTarget','roomsPage','roomCard','filterRooms','openRoom','closeRoom','routeRoom','numberRow'])assert.equal(card[name],undefined,name);
 await press(card,'climate-step','climate.bedroom_trv',{direction:1});await press(card,'room','office');await press(card,'floor','First floor');
 assert.equal(calls.length,0);
});
test('drawer routes belong to their page and direct links validate the drawer id',()=>{
 const {card}=harness({});globalThis.location={hash:'#climate/attic'};
 try{
  assert.equal(card.readPage(),'climate');assert.equal(card.routeDetail(),'attic');
  for(const hash of ['#climate/missing','#climate/','#today/attic','#energy/house','#climate/hallway','#climate/bill','#energy/attic','#energy/']){location.hash=hash;assert.equal(card.routeDetail(),null,hash);}
  // Energy's sheets are its own (v33): #energy/<id>, never another page's.
  location.hash='#energy/bill';assert.equal(card.readPage(),'energy');assert.equal(card.routeDetail(),'bill');
  // And the Car's (v34): #car/<id>, never another page's, nor another page's on the Car.
  location.hash='#car/charging-energy';assert.equal(card.readPage(),'car');assert.equal(card.routeDetail(),'charging-energy');
  for(const hash of ['#car/bill','#car/attic','#car/','#energy/battery','#climate/charging-energy','#today/battery']){location.hash=hash;assert.equal(card.routeDetail(),null,hash);}
 }finally{delete globalThis.location;}
});

test('native details close the drawer synchronously before handing history to Home Assistant',()=>{
 const {card}=harness({}),events=[];
 card._react={};card._modal='attic';card._page='climate';card._visitId='visit';
 card.restoreDetailScroll=()=>{};card.dispatchEvent=event=>events.push(['event',event.detail.entityId]);
 globalThis.location={hash:'#climate/attic',pathname:'/maison-home/home',search:''};
 globalThis.history={state:{maisonDetail:'attic',maisonVisit:'visit'},back:()=>assert.fail('native handoff must not leave a pending traversal'),replaceState:(_a,_b,url)=>events.push(['replace',url])};
 try{card.moreInfo('sensor.office_sensor_temperature');assert.deepEqual(events,[['replace','/maison-home/home#climate'],['event','sensor.office_sensor_temperature']]);assert.equal(card._modal,null);}finally{delete globalThis.location;delete globalThis.history;}
});
test('navigation during drawer close waits for its browser Back traversal',()=>{
 const {card}=harness({}),events=[];
 card._react={};card._modal='attic';card._page='climate';card._visitId='visit';
 card.restoreDetailScroll=()=>{};card.resetPageScroll=()=>events.push('scroll');card.loadViewData=()=>{};
 globalThis.location={hash:'#climate/attic',pathname:'/maison-home/home',search:''};
 globalThis.history={state:{maisonDetail:'attic',maisonVisit:'visit'},back:()=>events.push('back'),pushState:(_a,_b,url)=>{events.push(url);location.hash=url.split('#')[1];},replaceState:()=>{}};
 try{
  card.closeDetail();card.navigatePage('energy');assert.deepEqual(events,['back']);
  location.hash='#climate';card.syncRoute();assert.equal(card._page,'energy');assert.deepEqual(events,['back','/maison-home/home#energy','scroll']);assert.equal(card._detailBackPending,false);
 }finally{delete globalThis.location;delete globalThis.history;}
});
test('a drawer opened in this visit owns one history entry and restores the page scroll',()=>{
 const {card}=harness({}),events=[];
 card._react={};card._page='climate';card._visitId='visit';card.loadViewData=()=>events.push('load');
 const scroller={scrollTop:420,isConnected:true,scrollTo:o=>events.push(['scroll',o.top])};
 card.scrollContainers=()=>[scroller];
 globalThis.requestAnimationFrame=fn=>fn();
 globalThis.location={hash:'#climate',pathname:'/maison-home/home',search:''};
 globalThis.history={state:null,pushState:(state,_b,url)=>{events.push(['push',state,url]);globalThis.history.state=state;location.hash=url.split('#')[1];},back:()=>events.push('back'),replaceState:()=>{}};
 try{
  card.openDetail('towel-rails');
  assert.equal(card._modal,'towel-rails');
  assert.deepEqual(events[0],['push',{maisonDetail:'towel-rails',maisonVisit:'visit'},'/maison-home/home#climate/towel-rails']);
  card.openDetail('missing');assert.equal(card._modal,'towel-rails','an unknown drawer is ignored');
  card.closeDetail();assert.ok(events.includes('back'));
  location.hash='#climate';card.syncRoute();
  assert.equal(card._modal,null);assert.ok(events.some(e=>Array.isArray(e)&&e[0]==='scroll'&&e[1]===420),'the page scroll is restored');
 }finally{delete globalThis.location;delete globalThis.history;delete globalThis.requestAnimationFrame;}
});
// Energy's sheets (v33) are drawers of their own page, routed as Climate's
// are: opening one pushes #energy/<id>, the browser's Back closes it, and so
// does close detail, by going back rather than adding an entry.
test('an Energy sheet opened in this visit owns one history entry: push, Back and close detail',async()=>{
 const {card}=harness({}),events=[];
 card._react={};card._page='energy';card._visitId='visit';card.loadViewData=()=>events.push('load');
 const scroller={scrollTop:260,isConnected:true,scrollTo:o=>events.push(['scroll',o.top])};
 card.scrollContainers=()=>[scroller];
 globalThis.requestAnimationFrame=fn=>fn();
 globalThis.location={hash:'#energy',pathname:'/maison-home/home',search:''};
 globalThis.history={state:null,pushState:(state,_b,url)=>{events.push(['push',state,url]);globalThis.history.state=state;location.hash=url.split('#')[1];},back:()=>events.push('back'),replaceState:(_a,_b,url)=>events.push(['replace',url])};
 const pushed=()=>events.filter(e=>e[0]==='push');
 try{
  // Another page's drawer is not Energy's to open.
  for(const id of ['attic','house','towel-rails','missing',''])card.openDetail(id);
  assert.deepEqual([card._modal??null,pushed()],[null,[]]);
  for(const {id} of ENERGY_DETAILS){
   events.length=0;history.state=null;
   card.openDetail(id);
   assert.equal(card._modal,id);
   assert.deepEqual(pushed(),[['push',{maisonDetail:id,maisonVisit:'visit'},`/maison-home/home#energy/${id}`]],id);
   assert.equal(events.at(-1),'load','the sheet’s page loads its data');
   // Back: the browser pops to #energy, which closes the sheet and restores the page's scroll.
   location.hash='#energy';card.syncRoute();
   assert.deepEqual([card._page,card._modal],['energy',null],id);
   assert.ok(events.some(e=>Array.isArray(e)&&e[0]==='scroll'&&e[1]===260),`${id}: the page scroll is restored`);
  }
  // Close detail, as the sheet's value sends it, goes back rather than adding an entry.
  events.length=0;history.state=null;card.openDetail('bill');
  await press(card,'close','detail');
  assert.equal(card._modal,null);assert.deepEqual(events.filter(e=>e==='back'||e[0]==='replace'),['back']);assert.equal(pushed().length,1);
  location.hash='#energy';card.syncRoute();assert.equal(card._detailBackPending,false);
  // On Climate, Energy's sheets don't open.
  card._page='climate';location.hash='#climate';events.length=0;
  for(const {id} of ENERGY_DETAILS)card.openDetail(id);
  assert.deepEqual([card._modal,pushed()],[null,[]]);
 }finally{delete globalThis.location;delete globalThis.history;delete globalThis.requestAnimationFrame;}
});
test('a direct #energy/<id> link opens its sheet, and closing it or opening a reading replaces the fragment with #energy',()=>{
 const {card}=harness({}),events=[];
 card._react={};card._visitId='visit';card.restoreDetailScroll=()=>{};card.dispatchEvent=event=>events.push(['event',event.detail.entityId]);
 globalThis.location={hash:'#energy/energy-today',pathname:'/maison-home/home',search:''};
 globalThis.history={state:null,back:()=>assert.fail('a direct link has no entry of its own to go back to'),replaceState:(_a,_b,url)=>events.push(['replace',url])};
 try{
  card._page=card.readPage();card._modal=card.routeDetail();
  assert.deepEqual([card._page,card._modal],['energy','energy-today']);
  card.closeDetail();assert.deepEqual([card._modal,events],[null,[['replace','/maison-home/home#energy']]]);
  // A reading's details from a sheet hand over to Home Assistant with the sheet closed.
  events.length=0;card._modal='energy-today';
  card.moreInfo(E.solarToday);
  assert.deepEqual([card._modal,events],[null,[['replace','/maison-home/home#energy'],['event',E.solarToday]]]);
 }finally{delete globalThis.location;delete globalThis.history;}
});
// The Car's sheets (v34) are routed as Energy's: opening one pushes
// #car/<id>, the browser's Back closes it, and so does close detail.
test('a Car sheet opened in this visit owns one history entry: push, Back and close detail',async()=>{
 const {card}=harness({}),events=[];
 card._react={};card._page='car';card._visitId='visit';card.loadViewData=()=>events.push('load');
 const scroller={scrollTop:180,isConnected:true,scrollTo:o=>events.push(['scroll',o.top])};
 card.scrollContainers=()=>[scroller];
 globalThis.requestAnimationFrame=fn=>fn();
 globalThis.location={hash:'#car',pathname:'/maison-home/home',search:''};
 globalThis.history={state:null,pushState:(state,_b,url)=>{events.push(['push',state,url]);globalThis.history.state=state;location.hash=url.split('#')[1];},back:()=>events.push('back'),replaceState:(_a,_b,url)=>events.push(['replace',url])};
 const pushed=()=>events.filter(e=>e[0]==='push');
 try{
  // Another page's drawer or sheet is not the Car's to open.
  for(const id of ['attic','bill','energy-today','missing',''])card.openDetail(id);
  assert.deepEqual([card._modal??null,pushed()],[null,[]]);
  for(const {id} of CAR_DETAILS){
   events.length=0;history.state=null;
   card.openDetail(id);
   assert.equal(card._modal,id);
   assert.deepEqual(pushed(),[['push',{maisonDetail:id,maisonVisit:'visit'},`/maison-home/home#car/${id}`]],id);
   location.hash='#car';card.syncRoute();
   assert.deepEqual([card._page,card._modal],['car',null],id);
   assert.ok(events.some(e=>Array.isArray(e)&&e[0]==='scroll'&&e[1]===180),`${id}: the page scroll is restored`);
  }
  events.length=0;history.state=null;card.openDetail('battery');
  await press(card,'close','detail');
  assert.equal(card._modal,null);assert.deepEqual(events.filter(e=>e==='back'||e[0]==='replace'),['back']);assert.equal(pushed().length,1);
  location.hash='#car';card.syncRoute();assert.equal(card._detailBackPending,false);
  // On Energy, the Car's sheets don't open.
  card._page='energy';location.hash='#energy';events.length=0;
  for(const {id} of CAR_DETAILS)card.openDetail(id);
  assert.deepEqual([card._modal,pushed()],[null,[]]);
 }finally{delete globalThis.location;delete globalThis.history;delete globalThis.requestAnimationFrame;}
});
test('a direct #car/<id> link opens its sheet, and closing it or opening a reading replaces the fragment with #car',()=>{
 const {card}=harness({}),events=[];
 card._react={};card._visitId='visit';card.restoreDetailScroll=()=>{};card.dispatchEvent=event=>events.push(['event',event.detail.entityId]);
 globalThis.location={hash:'#car/battery',pathname:'/maison-home/home',search:''};
 globalThis.history={state:null,back:()=>assert.fail('a direct link has no entry of its own to go back to'),replaceState:(_a,_b,url)=>events.push(['replace',url])};
 try{
  card._page=card.readPage();card._modal=card.routeDetail();
  assert.deepEqual([card._page,card._modal],['car','battery']);
  card.closeDetail();assert.deepEqual([card._modal,events],[null,[['replace','/maison-home/home#car']]]);
  // A reading's details from a sheet hand over to Home Assistant with the sheet closed.
  events.length=0;card._modal='battery';
  card.moreInfo(E.carLastBattery);
  assert.deepEqual([card._modal,events],[null,[['replace','/maison-home/home#car'],['event',E.carLastBattery]]]);
 }finally{delete globalThis.location;delete globalThis.history;}
});
test('an open Car sheet loads nothing: the Car’s values are all in its states',async()=>{
 const {card}=harness(structuredClone(CLIMATE_FIXTURES[0].states)),groups=[],schedules=[];
 card.loadHistoryGroup=key=>groups.push(key);card.loadZoneSchedules=ids=>schedules.push(ids);
 for(const {id} of CAR_DETAILS){
  groups.length=0;schedules.length=0;card._page='car';card._modal=id;
  await card.loadViewData();
  assert.deepEqual([groups,schedules],[[],[]],id);
 }
 // While Energy's page, open under the same card, loads its own.
 card._page='energy';card._modal=null;
 await card.loadViewData();
 assert.deepEqual(groups,['energy']);
});
test('an open Energy sheet loads Energy’s power chart and nothing of Climate’s',async()=>{
 const {card}=harness(structuredClone(CLIMATE_FIXTURES[0].states)),groups=[],schedules=[];
 card.loadHistoryGroup=key=>groups.push(key);card.loadZoneSchedules=ids=>schedules.push(ids);
 for(const {id} of ENERGY_DETAILS){
  groups.length=0;schedules.length=0;card._page='energy';card._modal=id;
  await card.loadViewData();
  assert.deepEqual([groups,schedules],[['energy'],[]],id);
 }
 // A Climate drawer still loads its own.
 groups.length=0;card._page='climate';card._modal='attic';
 await card.loadViewData();
 assert.deepEqual([groups,schedules.length],[['climate-attic'],1]);
});
test('completed feedback expires independently for multiple entities',async()=>{
 const {card}=harness({});card.setFeedback('input_boolean.one','One confirmed',5);card.setFeedback('input_boolean.two','Two waiting');
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(card._feedback.has('input_boolean.one'),false);assert.equal(card._feedback.get('input_boolean.two'),'Two waiting');assert.equal(card._actionStatus,'Two waiting');
});

test('React mounting waits for the card configuration and first hass assignment',async()=>{
 const card=Object.create(Maison.prototype);card.isConnected=true;
 await card.ensureReact();assert.equal(card.loadState().state,'idle');
 card._config={};await card.ensureReact();assert.equal(card.loadState().state,'idle');
 let retries=0;card.render=()=>{};card.ensureReact=()=>retries++;
 card.setConfig({});assert.equal(retries,1);
 card.applyTheme=()=>{};card._native=new Map();card.reconcileActions=()=>{};card.scheduleRender=()=>{};
 card.hass={connected:false};assert.equal(retries,2);
});
// A release bumps every stamp at once; one left behind loads a stale module next to new ones.
test('every file of a Maison release carries the same ?v= stamp',()=>{
 const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
 const stamps=text=>[...text.matchAll(/\?v=(\d+)/g)].map(m=>m[1]);
 const sources=readdirSync(new URL('../config/www/maison/',import.meta.url)).filter(name=>name.endsWith('.js')).map(name=>`config/www/maison/${name}`);
 // The gallery page imports the served screen.js and hands it to the gallery bundle.
 const found=Object.fromEntries([...sources,'config/dashboards/maison-dashboard.yaml','dev/maison/gallery.html'].map(path=>[path,stamps(read(path))]));
 found['the React bundle URL']=stamps(Maison.prototype.bundleURL(1));
 for(const path of ['config/www/maison/maison-dashboard.js','config/dashboards/maison-dashboard.yaml','dev/maison/gallery.html','the React bundle URL'])assert.ok(found[path].length,`${path} has no ?v= stamp`);
 const release=found['config/www/maison/maison-dashboard.js'][0];
 for(const [path,list] of Object.entries(found))for(const stamp of list)assert.equal(stamp,release,`${path} carries ?v=${stamp}, not ?v=${release}`);
 // An import with no stamp at all would load a stale module too: every sibling import is stamped, the sky's (#29) among them.
 assert.ok(sources.includes('config/www/maison/sky.js'),'the sky is a served module');
 for(const path of sources)for(const [spec] of read(path).matchAll(/(?<=\bfrom\s*['"])\.\/[^'"]+/g))assert.match(spec,/\?v=\d+$/,`${path} imports ${spec} without a ?v= stamp`);
});
// Maison renders only with React (ADR 0005): no bundle, no readings or controls.
test('every retry imports the React bundle under a fresh URL',()=>{
 const card=Object.create(Maison.prototype);
 assert.match(card.bundleURL(0),/^\.\/vendor\/maison-react\.js\?v=\d+$/);
 assert.equal(card.bundleURL(2),`${card.bundleURL(0)}&retry=2`);
});
test('a bundle that fails to load is recorded for Retry and never throws',async()=>{
 const card=Object.create(Maison.prototype),attempts=[],logged=[],error=console.error;
 card.isConnected=true;card._hass={states:{},connected:true};card._config={};
 card.loadBundle=attempt=>{attempts.push(attempt);return Promise.reject(new Error('Bundle unreachable'));};
 console.error=(...args)=>logged.push(args);
 try{
  await card.ensureReact();
  assert.deepEqual(card._load,{state:'failed',attempt:0});assert.equal(card._react,undefined);
  assert.equal(logged.length,1);assert.doesNotThrow(()=>{card.render();card.toast('Nothing to show it in');});
  await card.ensureReact();assert.deepEqual(attempts,[0],'a state update does not import again after a failure');
  card.retryBundle();assert.deepEqual(attempts,[0,1]);assert.deepEqual(card._load,{state:'loading',attempt:1});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(card._load,{state:'failed',attempt:1});
 }finally{console.error=error;}
});
// Home Assistant can take the card off the page and put it back, as when a
// view is left and opened again: the bundle mounts again then.
test('a card taken off the page and put back mounts React again',async()=>{
 const card=Object.create(Maison.prototype),mounts=[];
 card.isConnected=true;card._hass={states:{},connected:true};card._config={};card.loadViewData=()=>{};card.render=()=>{};
 card.shadowRoot={querySelector:()=>({replaceChildren(){}})};
 card.loadBundle=async attempt=>({mountDashboard:()=>{mounts.push(attempt);return {update(){},toast(){},unmount(){mounts.push('unmounted');}};}});
 Object.assign(globalThis.window,{addEventListener(){},removeEventListener(){}});
 globalThis.location={hash:'#today',pathname:'/maison-home/home',search:''};
 try{
  await card.ensureReact();assert.equal(card._load.state,'ready');
  card.disconnectedCallback();assert.equal(card._react,null);assert.equal(card._load.state,'idle');
  await card.ensureReact();assert.deepEqual(mounts,[0,'unmounted',0]);assert.equal(card._load.state,'ready');
 }finally{delete globalThis.location;delete globalThis.window.addEventListener;delete globalThis.window.removeEventListener;}
});
test('a loaded bundle mounts React, which then draws every render',async()=>{
 const card=Object.create(Maison.prototype),mounted=[],toasts=[],screens=[],wrap={replaceChildren(){this.cleared=true;}};
 card.isConnected=true;card._hass={states:{},connected:true};card._config={};card._page='climate';card.loadViewData=()=>{};
 card.shadowRoot={querySelector:selector=>selector==='.wrap'?wrap:null};
 card.loadBundle=async attempt=>{assert.equal(attempt,0);return {mountDashboard:(root,controller)=>{mounted.push([root,controller]);return {update:s=>screens.push(s),toast:m=>toasts.push(m),unmount(){}};}};};
 globalThis.location={hash:'#climate/attic',pathname:'/maison-home/home',search:''};
 try{await card.ensureReact();}finally{delete globalThis.location;}
 assert.equal(mounted.length,1);assert.equal(mounted[0][0],wrap);assert.equal(wrap.cleared,true,'the loading line makes way');
 assert.equal(card._modal,'attic');assert.equal(card._load.state,'ready');
 // React gets exactly the shadow root and the element's two doors, never the element.
 const controller=mounted[0][1],pressed=[],attached=[];
 assert.deepEqual(Object.keys(controller).sort(),['attachNative','command','shadowRoot']);assert.equal(controller.shadowRoot,card.shadowRoot);
 card.command=intent=>pressed.push(intent);card.attachNative=(...args)=>attached.push(args);
 controller.command({command:'navigate',entity:'energy'});controller.attachNative('slot','calendar-full',{type:'calendar'});
 assert.deepEqual([pressed,attached],[[{command:'navigate',entity:'energy'}],[['slot','calendar-full',{type:'calendar'}]]]);
 // Each render hands React the screen of one snapshot: the page, and the drawer the route names.
 assert.equal(screens.length,1);assert.equal(screens[0].page.id,'climate');
 const {id,title,eyebrow,body}=screens[0].drawer;
 assert.deepEqual({id,title,eyebrow,kind:body.kind},{id:'attic',title:'Attic',eyebrow:'Alex’s office · Playground',kind:'zone'});
 card._modal=null;card.render();assert.equal(screens.length,2);assert.equal(screens[1].drawer,null);
 card.toast('Request sent');assert.deepEqual(toasts,['Request sent']);
});

// ---- One design (#29 step 5) ----------------------------------------------------
// A connected card with hass, ready to mount. `calls` records each mount
// (as the keys it is passed), each unmount and each loading shell, in order.
function mountable(){
 const card=Object.create(Maison.prototype),calls=[],attributes=new Map();
 card.isConnected=true;card._hass={states:{},connected:true};card.loadViewData=()=>{};card.render=()=>{};
 card.shadowRoot={querySelector:()=>({replaceChildren(){}})};
 card.setAttribute=(name,value)=>attributes.set(name,value);card.removeAttribute=name=>attributes.delete(name);
 card.showLoadState=()=>calls.push('loading shell');
 card.loadBundle=async()=>({mountDashboard:(root,controller)=>{calls.push(Object.keys(controller).sort().join(' '));return {update(){},toast(){},unmount(){calls.push('unmounted');}};}});
 return {card,calls,attributes};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function atHome(run){globalThis.location={hash:'#today',pathname:'/maison-home/home',search:''};try{await run();}finally{delete globalThis.location;}}
test('a leftover design key is ignored, whatever its value, and sets no attribute',()=>{
 for(const config of [{},{design:'next'},{design:null},{design:'current'},{design:'dark'},{design:true},{design:{}},{design:0},undefined,null]){
  const {card,attributes}=mountable();card.isConnected=false;
  assert.doesNotThrow(()=>card.setConfig(config&&{type:'custom:maison-dashboard',...config}),JSON.stringify(config));
  assert.deepEqual([...attributes],[],JSON.stringify(config));
 }
});
test('a config set again, with or without a design, keeps React mounted in the one design',async()=>{
 const {card,calls,attributes}=mountable();
 await atHome(async()=>{
  card.setConfig({});await settle();const app=card._react,visit=card._visitId;assert.ok(app&&visit);
  for(const design of ['next','current',null,undefined]){card.setConfig({type:'custom:maison-dashboard',design});await settle();}
  card.setConfig({});await settle();
  assert.deepEqual(calls,['attachNative command shadowRoot'],'one mount, told no design, never unmounted or shown loading again');
  assert.equal(card._react,app);assert.equal(card._visitId,visit,'the same visit, so an open drawer still closes with Back');
  assert.equal(attributes.has('design'),false);
 });
});

// ---- The seam (#27) ----------------------------------------------------------
test('a snapshot reads the clock once, defaults every field and has the fixture snapshot’s shape',()=>{
 const bare=Object.create(Maison.prototype),realNow=Date.now;let reads=0,snap;
 Date.now=()=>{reads++;return 1234;};
 try{snap=bare.snapshot();}finally{Date.now=realNow;}
 assert.equal(reads,1,'now is read once');assert.equal(snap.now,1234);
 assert.deepEqual({...snap},fixtureSnapshot({now:1234}),'an element with nothing set up yet reads as the defaults');
});
test('a snapshot is frozen where the element made it and keeps its view when the element changes',()=>{
 const states={[E.heatingAuto]:state('on')},{card}=harness(states);
 Object.assign(card,{_page:'climate',_modal:'attic',_dialog:{kind:'alerts'},_climate:{house:{base:20,temperature:21},houseEnd:'3h'},
  _feedback:new Map([[E.heatingAuto,'Sent']]),_historyPages:{energy:{data:{},start:1,end:2}},_historyRequests:new Set(['climate-attic']),_schedules:{'schedule.attic_occupied':{}},_actionStatus:'Sent'});
 card._busy.add(E.heatingAuto);
 const snap=card.snapshot();
 assert.equal(snap.states,states,'Home Assistant\'s states are shared, never copied');assert.equal(Object.isFrozen(states),false,'nor frozen');
 for(const part of [snap,snap.route,snap.route.dialog,snap.draft,snap.sensors,snap.loaded,snap.loaded.history,snap.loaded.schedules])assert.ok(Object.isFrozen(part));
 assert.deepEqual(snap.route,{page:'climate',detail:'attic',dialog:{kind:'alerts'}});
 card._dialog={kind:'native',native:'history',chart:'power'};assert.deepEqual(snap.route.dialog,{kind:'alerts'},'a later dialog is not this snapshot’s');
 assert.deepEqual(card.snapshot().route.dialog,{kind:'native',native:'history',chart:'power'});
 card._dialog=null;assert.equal(card.snapshot().route.dialog,null);
 assert.deepEqual(snap.draft,{house:{base:20,temperature:21},houseEnd:'3h',awayUntil:''});
 assert.deepEqual([snap.online,snap.tz,snap.status],[true,'Europe/Brussels','Sent']);
 card._busy.clear();card._feedback.clear();card._historyPages.power={};card._historyRequests.clear();card._schedules.x={};card._climate.houseEnd='1h';
 assert.deepEqual([[...snap.busy],[...snap.feedback.keys()],Object.keys(snap.loaded.history),[...snap.loaded.historyLoading],Object.keys(snap.loaded.schedules),snap.draft.houseEnd],
  [[E.heatingAuto],[E.heatingAuto],['energy'],['climate-attic'],['schedule.attic_occupied'],'3h']);
});
test('command changes the draft or sends a call exactly when the kit draws its control enabled',async()=>{
 const {card,calls}=harness(structuredClone(CLIMATE_FIXTURES.find(f=>f.id==='house_running').states));let renders=0;card.render=()=>renders++;
 const away={command:'away-until',entity:'house',value:'2026-10-18T15:00'},step={command:'house-step',entity:'house',direction:1};
 assert.equal(enabled(card,away),true);
 await card.command(away);
 assert.deepEqual(card._climate,{awayUntil:'2026-10-18T15:00'});assert.equal(renders,1);assert.deepEqual(calls,[]);
 assert.equal(card.snapshot().draft.awayUntil,'2026-10-18T15:00');
 // While the thermostat has a request in flight, its draft waits too.
 card._busy.add(CLIMATE_CONTRACT.houseHeating);
 assert.equal(enabled(card,step),false);await card.command(step);assert.equal(card._climate.house,undefined);
 card._busy.clear();await card.command(step);assert.deepEqual(card._climate.house,{base:20,temperature:20.5});
 // A call reaches service() once, under the guard's key.
 const toggle={command:'toggle',entity:CLIMATE_CONTRACT.aircoCooling};
 assert.equal(enabled(card,toggle),true);await card.command(toggle);
 assert.deepEqual(calls,[['input_boolean','turn_off',{entity_id:CLIMATE_CONTRACT.aircoCooling}]]);
 assert.equal(enabled(card,toggle),false,'in flight');await card.command(toggle);assert.equal(calls.length,1);
 // Offline, every control is disabled and every press refused.
 card._hass.connected=false;card._busy.clear();
 for(const intent of [toggle,away,step])assert.equal(enabled(card,intent),false,intent.command);
 await card.command(toggle);await card.command({...away,value:''});assert.equal(calls.length,1);assert.equal(card._climate.awayUntil,'2026-10-18T15:00');
 // Navigation is a link: enabled whatever the connection, except more for an entity Home Assistant doesn't have.
 assert.equal(enabled(card,{command:'navigate',entity:'energy'}),true);
 assert.equal(enabled(card,{command:'more',entity:CLIMATE_CONTRACT.aircoCooling}),true);
 assert.equal(enabled(card,{command:'more',entity:'sensor.nowhere'}),false);
});

// ---- Dialogs, the sensor catalogue and Home Assistant's cards (#27) ----------
test('alerts, the full calendar and a chart’s full history each open their dialog',async()=>{
 const {card}=harness({});await press(card,'shopping','todo.shopping_list');
 assert.equal(card._dialog??null,null,'the shopping list left with Life (v35)');
 const cases=[[{command:'alerts'},{kind:'alerts'},'Home alerts'],
  [{command:'native-calendar'},{kind:'native',native:'calendar'},'Full calendar'],[{command:'native-history',entity:'power'},{kind:'native',native:'history',chart:'power'},'Power through the day']];
 for(const [intent,dialog,title] of cases){
  const {card}=harness({});let renders=0;card.render=()=>renders++;card._hass.connected=false;
  await card.command(intent);
  assert.deepEqual([card._dialog,renders],[dialog,1],`${intent.command}, offline too`);
  const shown=screen(card.snapshot()).dialog;
  assert.deepEqual([shown.kind,shown.title,shown.close.intent],[dialog.kind,title,{command:'close'}],intent.command);
 }
});
test('a chart’s full history opens only for a chart there is',async()=>{
 const {card}=harness({});
 for(const entity of ['nowhere','climate-attic-temperature','',undefined]){await press(card,'native-history',entity);assert.equal(card._dialog??null,null,String(entity));}
 card._hass.states=structuredClone(CLIMATE_FIXTURES[0].states);
 await press(card,'native-history','climate-attic-temperature');
 assert.deepEqual(card._dialog,{kind:'native',native:'history',chart:'climate-attic-temperature'});
 assert.equal(screen(card.snapshot()).dialog.native.key,'history-full-climate-attic-temperature');
});
test('close closes the dialog; close detail closes the drawer and leaves the dialog',async()=>{
 const {card}=harness({});let renders=0,closed=0;card.render=()=>renders++;card.closeDetail=()=>closed++;
 card._dialog={kind:'alerts'};
 await press(card,'close','detail');assert.deepEqual([closed,card._dialog],[1,{kind:'alerts'}]);
 await press(card,'close');assert.deepEqual([closed,card._dialog,renders],[1,null,1]);
 assert.equal(screen(card.snapshot()).dialog,null);
 // The drawer's own close, as React sends it from the drawer value.
 const drawer=harness(structuredClone(CLIMATE_FIXTURES[0].states)).card,urls=[];
 Object.assign(drawer,{_react:{},_modal:'attic',_page:'climate',restoreDetailScroll(){}});
 globalThis.location={hash:'#climate/attic',pathname:'/maison-home/home',search:''};
 globalThis.history={state:null,replaceState:(_a,_b,url)=>urls.push(url)};
 try{
  const {close}=screen(drawer.snapshot()).drawer;
  await drawer.command(close.intent);
  assert.deepEqual([drawer._modal,urls],[null,['/maison-home/home#climate']]);
 }finally{delete globalThis.location;delete globalThis.history;}
});
test('the sensor search and category filter at once, from the top of the list',async()=>{
 const {card}=harness(structuredClone(HOME_FIXTURES[0].states));let renders=0,scheduled=0;
 card.render=()=>renders++;card.scheduleRender=()=>scheduled++;card._page='system';card._hass.config={time_zone:'Europe/Brussels'};
 const sensors=()=>screen(card.snapshot()).page.sensors;
 await card.command({command:'sensor-more'});assert.equal(card.snapshot().sensors.limit,120);
 // React sends the field's intent with what was typed, and the select's with the option chosen.
 await card.command({...sensors().search.intent,value:'temp'});
 assert.deepEqual(card.snapshot().sensors,{query:'temp',category:'all',limit:60},'a new search starts from the top');
 assert.deepEqual([renders,scheduled],[2,0],'rendered at once, not after 250 ms, or the next keystroke is lost');
 assert.deepEqual([sensors().search.value,sensors().summary],['temp','2 matching readings · 1 unavailable']);
 await card.command({command:'sensor-more'});
 await card.command({...sensors().category.intent,value:'battery'});
 assert.deepEqual(card.snapshot().sensors,{query:'temp',category:'battery',limit:60});
 assert.deepEqual([renders,scheduled],[4,0]);
 await card.command({...sensors().search.intent,value:''});
 assert.deepEqual([sensors().category.selected,sensors().summary],['battery','2 matching readings · 0 unavailable']);
 // Filtering is the viewer's own, whatever the connection.
 card._hass.connected=false;await card.command({...sensors().category.intent,value:'all'});
 assert.deepEqual(card.snapshot().sensors,{query:'',category:'all',limit:60});
});
test('Show more shows the next sixty readings',async()=>{
 const {card}=harness({});let renders=0;card.render=()=>renders++;
 await card.command({command:'sensor-more'});await card.command({command:'sensor-more'});
 assert.deepEqual([card.snapshot().sensors.limit,renders],[180,2]);
});

// A Home Assistant card's slot, and the nodes the element puts in it.
const node=tag=>({tagName:tag.toUpperCase(),className:'',textContent:'',isConnected:true,children:[],
 get firstElementChild(){return this.children[0]??null;},replaceChildren(...nodes){this.children=nodes;},append(...nodes){this.children.push(...nodes);}});
// A Maison element built by its own constructor.
function constructed(){globalThis.location={hash:'#system',pathname:'/maison-home/home',search:''};try{return new Maison();}finally{delete globalThis.location;}}
test('attachNative makes one Home Assistant card per key, places it in its slot and keeps it current',async()=>{
 const card=constructed(),created=[],first={states:{},connected:true},second={states:{},connected:true};
 card.hass=first;
 globalThis.window.loadCardHelpers=async()=>({createCardElement:config=>{const made={config};created.push(made);return made;}});
 try{
  const slot=node('div'),again=node('div'),other=node('div'),config={type:'calendar',initial_view:'listWeek',entities:[...CALENDARS]};
  await card.attachNative(slot,'calendar-full',config);
  assert.deepEqual([created.length,created[0].config,slot.children],[1,config,[created[0]]]);
  assert.equal(created[0].hass,first);
  // The same key in a new slot moves the same card; another key makes its own.
  await card.attachNative(again,'calendar-full',config);
  await card.attachNative(other,'history-full-power',{type:'history-graph',hours_to_show:24,entities:[{entity:E.load,name:'Home'}]});
  assert.equal(created.length,2);assert.deepEqual(again.children,[created[0]]);assert.deepEqual(other.children,[created[1]]);
  card.hass=second;
  assert.deepEqual(created.map(c=>c.hass===second),[true,true],'every card follows Home Assistant');
 }finally{delete globalThis.window.loadCardHelpers;}
});
// A Home Assistant card in a sheet opens Home Assistant's own dialog outside
// Maison, which the sheet's modal would leave inert (#29, v35): Maison's
// dialog and drawer close first, and the event goes on untouched.
test('a Home Assistant card’s own dialog closes Maison’s dialog and drawer, and goes on to Home Assistant',()=>{
 const card=constructed(),replaced=[];card.render=()=>{};
 const slot={classList:{contains:name=>name==='native'}},deep={classList:{contains:()=>false}};
 const event=(type,path)=>({type,composedPath:()=>path,stopPropagation:()=>assert.fail(`${type} stopped`),stopImmediatePropagation:()=>assert.fail(`${type} stopped`),preventDefault:()=>assert.fail(`${type} prevented`)});
 globalThis.location={hash:'#climate/attic',pathname:'/maison-home/home',search:''};
 globalThis.history={state:null,replaceState:(_a,_b,url)=>replaced.push(url)};globalThis.requestAnimationFrame=()=>{};
 try{
  assert.deepEqual(Object.keys(card.listeners).sort(),['hass-more-info','show-dialog']);
  // From a card in the Full calendar or a chart's full history: the dialog closes.
  for(const type of ['show-dialog','hass-more-info']){
   card._page='today';card._modal=null;card._dialog={kind:'native',native:'calendar'};
   card.listeners[type](event(type,[deep,deep,slot,card]));
   assert.equal(card._dialog,null,type);
  }
  // Over a Climate drawer, both close, the drawer's fragment replaced.
  card._page='climate';card._modal='attic';card._dialog={kind:'native',native:'history',chart:'climate-attic-temperature'};
  card.listeners['hass-more-info'](event('hass-more-info',[deep,slot,card]));
  assert.deepEqual([card._dialog,card._modal,replaced],[null,null,['/maison-home/home#climate']]);
  // Maison's own more-info, or a dialog from anywhere but a card, leaves Maison as it is.
  card._modal='attic';card._dialog={kind:'alerts'};
  card.listeners['hass-more-info'](event('hass-more-info',[card]));
  card.listeners['show-dialog'](event('show-dialog',[deep,card]));
  assert.deepEqual([card._dialog,card._modal],[{kind:'alerts'},'attic']);
 }finally{delete globalThis.location;delete globalThis.history;delete globalThis.requestAnimationFrame;}
});
test('when Home Assistant’s card helpers can’t load, the slot says why, as text',async()=>{
 const card=constructed();card.hass={states:{},connected:true};
 globalThis.document={createElement:node};
 globalThis.window.loadCardHelpers=()=>Promise.reject(new Error('<b>Helpers</b> failed & stopped'));
 try{
  const slot=node('div');await card.attachNative(slot,'calendar-full',{type:'calendar'});
  assert.deepEqual(slot.children.map(n=>[n.tagName,n.className,n.textContent]),[['P','note','<b>Helpers</b> failed & stopped']]);
  // A failure is not kept: the next slot asks again.
  delete globalThis.window.loadCardHelpers;
  const later=node('div');await card.attachNative(later,'history-full-power',{type:'history-graph'});
  assert.deepEqual(later.children.map(n=>[n.className,n.textContent]),[['note','Card helpers are not ready. Reload the dashboard.']]);
  globalThis.window.loadCardHelpers=async()=>({createCardElement:config=>({config})});
  await card.attachNative(slot,'calendar-full',{type:'calendar'});
  assert.deepEqual(slot.children.map(n=>n.config),[{type:'calendar'}],'once the helpers load, the card replaces the note');
 }finally{delete globalThis.window.loadCardHelpers;delete globalThis.document;}
});

test('charging override dispatches the managed script and never a raw switch',async()=>{
 const {card,calls}=harness({[E.carConnected]:state('on'),[E.carOnline]:state('on'),[E.carSession]:state('verified'),[E.carPolicy]:state('peak_wait',{vehicle_data_valid:true}),['script.tesla_charge_now']:state('off')});
 await press(card,'charge-now');
 assert.deepEqual(calls,[['script','turn_on',{entity_id:'script.tesla_charge_now'}]]);
 const absent=harness({[E.carConnected]:state('off'),['script.tesla_charge_now']:state('off')});
 await press(absent.card,'charge-now');assert.equal(absent.calls.length,0);
});

test('charge limit edits use the Tesla number entity and wait for observed confirmation',async()=>{
 const {card,calls}=harness({[E.carConnected]:state('on'),[E.carOnline]:state('on'),[E.carLimit]:state('80',{min:50,max:100,step:1}),[E.carSession]:state('verified'),[E.carPolicy]:state('solar_wait',{vehicle_data_valid:true})});
 await press(card,'charge-limit',E.carLimit,{direction:1});
 assert.deepEqual(calls,[['number','set_value',{value:85,entity_id:E.carLimit}]]);
 const confirmed=expectedOutcome('number','set_value',{value:85});
 assert.equal(confirmed(state('80')),false);assert.equal(confirmed(state('85')),true);
});

test('the Car keeps pacing and cloud deadlines from the policy one tap away, in the Battery sheet’s Why',()=>{
 for(const reason of ['Holding current: next routine adjustment at 13:10:00.', 'Cloud ride-through at 5 A; temporary grid import allowed until 13:15.', 'Solar charging paused. Restart after 13:30, with confirmed surplus.']){
  const {card}=harness({[E.carConnected]:state('on'),[E.carSession]:state('verified'),[E.carPolicy]:state('surplus',{vehicle_data_valid:true,reason})});
  card._hass.config={time_zone:'Europe/Brussels'};card._page='car';card._modal='battery';
  const {why,summary}=screen(card.snapshot()).drawer.body;
  assert.deepEqual([why.title,why.paragraphs[0]],['Why',reason]);assert.ok(![summary.headline,summary.detail].includes(reason));
 }
});
