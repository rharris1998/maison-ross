import { E, ROOM_DETAIL, CALENDARS, available, pretty } from './model.js?v=38';
import { icon } from './icons.js?v=38';
import { styles } from './styles.js?v=38';

import {loadAgenda, loadHistory, loadSchedules} from './data.js?v=38';
import {expectedOutcome} from './actions.js?v=38';
import {WRITE_COMMANDS} from './guard.js?v=38';
import {rememberedHeadline, CAR_DETAILS} from './car.js?v=38';
import {CLIMATE_DETAILS, climateHistory, climateSchedules} from './climate.js?v=38';
import {POWER_HISTORY, ENERGY_DETAILS} from './energy.js?v=38';
import {screen, allowed, historyDefinition, PAGE_IDS} from './screen.js?v=38';
import {dayWindow} from './history.js?v=38';
import {SENSOR_PAGE} from './system.js?v=38';
const EMPTY_AGENDA=Object.freeze({events:Object.freeze([]),errors:Object.freeze({}),status:Object.freeze({})});
// Drawers addressable as #<page>/<id>, as '<page>/<id>': Climate's (#21) and,
// from v33, Energy's sheets and, from v34, the Car's (#29 step 4).
const DETAILS=new Set([...CLIMATE_DETAILS.map(d=>`climate/${d.id}`),...ENERGY_DETAILS.map(d=>`energy/${d.id}`),...CAR_DETAILS.map(d=>`car/${d.id}`)]);

class MaisonDashboard extends HTMLElement {
  constructor() {
    super(); this.attachShadow({mode:'open'});
    this.shadowRoot.innerHTML = `<style>${styles}</style><div class="wrap"><p class="m-loading" role="status">Loading Maison…</p></div>`;
    this._page = this.readPage(); this._native=new Map();
    this._busy=new Set(); this._forecasts=[]; this._forecastTime=0;
    this._pending=new Map();this._feedback=new Map();
    this._agenda={events:[],errors:{},status:{}};this._historyTimes={};this._historyRequests=new Set();
    this._schedules={};this._scheduleTimes={};this._scheduleRequests=new Set();
    this._sensorQuery='';this._sensorCategory='all';this._sensorLimit=SENSOR_PAGE;
    // What the viewer has chosen on the house heating card but not sent: the
    // override stepper, its end chip and the Away date. Memory only.
    this._climate={house:null,houseEnd:null,awayUntil:''};
    this._hashChange=()=>this.syncRoute();
    // A Home Assistant card in Maison opening Home Assistant's own dialog.
    this._cardDialog=event=>this.yieldToCardDialog(event);
    for(const type of ['show-dialog','hass-more-info'])this.addEventListener(type,this._cardDialog);
  }
  // Rooms became Climate in v21 (#21): #rooms opens the page and #rooms/<room>
  // the drawer of that room's zone; the Hallway belongs to no zone. Life left
  // in v35 (#29): a #life link opens Today.
  readPage() {
    const [v,sub]=location.hash.replace('#','').split('/');
    if(v==='rooms'){const detail=ROOM_DETAIL[sub]||null;history.replaceState(null,'',`${location.pathname}${location.search}#climate${detail?'/'+detail:''}`);return 'climate';}
    if(v==='life'){history.replaceState(null,'',`${location.pathname}${location.search}#today`);return 'today';}
    return PAGE_IDS.includes(v)?v:'today';
  }
  routeDetail() { const [page,id]=location.hash.replace('#','').split('/');return DETAILS.has(`${page}/${id}`)?id:null; }
  syncRoute() {
    const afterBack=this._detailBackPending?this._afterDetailBack:null;
    this._detailBackPending=false;this._afterDetailBack=null;
    const previous=this._page,hadDetail=this._modal;
    this._page=this.readPage();this._modal=this.routeDetail();this._dialog=null;
    this.render();this.loadViewData();
    if(previous!==this._page)this.resetPageScroll();
    else if(hadDetail&&!this._modal)this.restoreDetailScroll();
    afterBack?.();
  }
  navigatePage(page) {
    if(this._detailBackPending){this._afterDetailBack=()=>this.navigatePage(page);return;}
    if(!PAGE_IDS.includes(page))return;
    this._page=page;this._modal=null;this._dialog=null;this._detailScroll=null;
    if(location.hash!==`#${page}`)(history.pushState||history.replaceState).call(history,{maisonPage:page},'',`${location.pathname}${location.search}#${page}`);
    this.render();
    this.resetPageScroll();
    this.loadViewData();
  }
  scrollContainers() {
    const result=[];
    for(let node=this;node;node=node.assignedSlot||node.parentElement||node.getRootNode?.().host)result.push(node);
    if(document.scrollingElement&&!result.includes(document.scrollingElement))result.push(document.scrollingElement);
    return result;
  }
  restoreDetailScroll() {
    const positions=this._detailScroll||[],page=this._page;this._detailScroll=null;
    requestAnimationFrame(()=>{if(this._page!==page||this._modal)return;for(const [node,top] of positions)if(node.isConnected)node.scrollTo?.({top,behavior:'instant'});});
  }
  closeDetail({replace=false}={}) {
    if(!this._modal)return;
    this._modal=null;
    // A drawer opened in this visit owns one browser-history entry. A direct
    // drawer link has no return entry, so closing replaces only its fragment.
    if(!replace&&history.state?.maisonDetail&&history.state?.maisonVisit===this._visitId){this._detailBackPending=true;history.back();}
    else history.replaceState(null,'',`${location.pathname}${location.search}#${this._page}`);
    this.render();this.restoreDetailScroll();
  }
  closeDialog() {this._dialog=null;this.render();}
  // Maison renders only with React (ADR 0005): it says so while the bundle
  // loads and offers Retry if the import fails. There is no HTML fallback.
  // The bundle's load is one value: {state: idle|loading|ready|failed, attempt}.
  loadState() { return this._load||={state:'idle',attempt:0}; }
  async ensureReact() {
    // One import at a time. After a failure only Retry imports again, so a state update never swaps the notice under a finger.
    if(this.loadState().state!=='idle'||!this.isConnected||!this.hass||!this._config)return;
    this._load={...this._load,state:'loading'};
    try {
      const {mountDashboard}=await this.loadBundle(this._load.attempt);
      if(!this.isConnected){this._load={...this._load,state:'idle'};return;}
      const root=this.shadowRoot?.querySelector('.wrap');root?.replaceChildren();
      this._modal=this.routeDetail();this._visitId=String(Date.now())+Math.random().toString(36).slice(2);
      this._react=mountDashboard(root,{shadowRoot:this.shadowRoot,command:intent=>this.command(intent),attachNative:(slot,key,config)=>this.attachNative(slot,key,config)});
      this._load={...this._load,state:'ready'};this.render();this.loadViewData();
    } catch(error){console.error('Maison UI load failed',error);this._load={...this._load,state:this._react?'ready':'failed'};if(!this._react)this.showLoadState();}
  }
  // A browser may keep a failed module import for the life of the page, so
  // every retry asks for the bundle under a new URL.
  bundleURL(attempt) { return `./vendor/maison-react.js?v=38${attempt?`&retry=${attempt}`:''}`; }
  // maison-ross: the first load names the bundle outright, so the release
  // build can fold it into the one file HACS serves; a retry asks again under
  // a fresh URL, which only the unbundled /local/maison copy can answer.
  loadBundle(attempt) { return attempt ? import(this.bundleURL(attempt)) : import('./vendor/maison-react.js?v=38'); }
  retryBundle() { this._load={state:'idle',attempt:this.loadState().attempt+1};this.showLoadState();this.ensureReact(); }
  // Until React mounts, .wrap holds one line in Maison's own markup, which
  // styles.js draws: p.m-loading, or the failure notice, div.m-notice with
  // its glyph, its title and button.m-notice__retry. Built from DOM nodes;
  // the glyph is Maison's own static markup.
  showLoadState() {
    const wrap=this.shadowRoot?.querySelector('.wrap');if(!wrap)return;
    const node=(tag,className,text='')=>{const el=document.createElement(tag);el.className=className;el.textContent=text;return el;};
    if(this.loadState().state!=='failed'){const line=node('p','m-loading','Loading Maison…');line.setAttribute('role','status');wrap.replaceChildren(line);return;}
    const notice=node('div','m-notice'),glyph=node('span','m-notice__glyph'),retry=node('button','m-notice__retry','Retry');
    notice.setAttribute('role','alert');glyph.innerHTML=icon('alert');retry.type='button';retry.addEventListener('click',()=>this.retryBundle());
    notice.append(glyph,node('p','m-notice__title','Maison couldn’t load. Reload to retry.'),retry);wrap.replaceChildren(notice);
  }
  resetPageScroll() {
    // HA scrolls inside shadow-root ancestors; the standalone preview scrolls
    // the document. Reset those containers instead of aligning the card itself,
    // which scrollIntoView can move underneath HA's header (or down from zero).
    for(let node=this;node;node=node.assignedSlot||node.parentElement||node.getRootNode?.().host) {
      node.scrollTo?.({top:0,behavior:'instant'});
    }
    document.scrollingElement?.scrollTo({top:0,behavior:'instant'});
  }
  // Maison has one design (#29 step 5), and its rules are scoped to the
  // host itself. A leftover `design` key, of any value (the retired second
  // dashboard's `design: next`, or a copy of it), is ignored: it sets no
  // attribute and never breaks the card.
  setConfig(config) {
    this._config={...config};
    this.render();if(this.isConnected)this.ensureReact();
  }
  getCardSize() { return 18; }
  set hass(hass) {
    this._hass=hass;
    // A Charger dropout keeps the last headline for five minutes, so remember
    // the latest one outside a dropout as each update arrives, never while
    // drawing. Memory only; nothing is stored.
    this._carLast=rememberedHeadline(hass?.states??{},{now:Date.now(),zone:this.zone(),last:this._carLast});
    this.applyTheme();
    for(const card of this._native.values()) card.hass=hass;
    this.reconcileActions();this.render();
    if(this.isConnected)this.ensureReact();
    if(this.isConnected&&hass?.connected!==false){this.loadForecast();this.loadViewData();}
  }
  get hass() { return this._hass; }
  // Maison follows Home Assistant's own theme rather than only the OS, so the
  // sidebar toggle and HA's auto mode flip this dashboard with everything else.
  applyTheme() {
    const dark = this.hass?.themes?.darkMode ?? window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
    this.toggleAttribute?.('dark', !!dark);
  }
  connectedCallback() {
    this.applyTheme();
    window.addEventListener('hashchange',this._hashChange);
    window.addEventListener('popstate',this._hashChange);this.ensureReact();
    clearInterval(this._timer); this._timer=setInterval(()=>{this.scheduleRender();this.loadForecast();this.loadViewData();},60000);
    this.scheduleRender();this.loadViewData();
  }
  disconnectedCallback() { window.removeEventListener('hashchange',this._hashChange);window.removeEventListener('popstate',this._hashChange);this._react?.unmount();this._react=null;if(this.loadState().state==='ready')this._load={...this._load,state:'idle'};clearInterval(this._timer);clearTimeout(this._renderTimer);clearTimeout(this._feedbackTimer);for(const t of this._feedbackTimers?.values()||[])clearTimeout(t);for(const p of this._pending?.values()||[])clearTimeout(p.timer);this._pending?.clear();this._busy?.clear(); }
  scheduleRender() { if(this._renderTimer)return;this._renderTimer=setTimeout(()=>{this._renderTimer=null;if(this.isConnected)this.render();},250); }
  state(id) { return this.hass?.states?.[id]; }
  attr(id,key) { return this.state(id)?.attributes?.[key]; }
  valid(id) { return available(this.state(id)); }
  online() { return this.hass?.connected!==false; }
  // Everything one render shows, read once (#27): `now` is read here only, so
  // every phrase and guard of a render agrees. Every field has a default, and
  // the containers the element keeps changing are copied, so a later load
  // can't change what a render saw. Only objects made here are frozen, never
  // Home Assistant's states.
  snapshot() {
    const now=Date.now(),hass=this._hass,climate=this._climate,dialog=this._dialog;
    return Object.freeze({
      states:hass?.states??{},online:this.online(),now,tz:this.zone(),user:hass?.user?.name??null,
      route:Object.freeze({page:this._page??'today',detail:this._modal??null,dialog:dialog?Object.freeze({...dialog}):null}),
      draft:Object.freeze({house:climate?.house??null,houseEnd:climate?.houseEnd??null,awayUntil:climate?.awayUntil??''}),
      sensors:Object.freeze({query:this._sensorQuery??'',category:this._sensorCategory??'all',limit:this._sensorLimit??SENSOR_PAGE}),
      busy:new Set(this._busy),feedback:new Map(this._feedback),status:this._actionStatus??'',
      loaded:Object.freeze({history:Object.freeze({...this._historyPages}),historyLoading:new Set(this._historyRequests),schedules:Object.freeze({...this._schedules}),
        agenda:this._agenda??EMPTY_AGENDA,agendaLoading:!!this._agendaLoading,forecasts:this._forecasts??[]}),
      carLast:this._carLast??null,
    });
  }
  // React draws what screen() works out from one snapshot (#27). An event
  // opens against the events this render drew, even if a background calendar
  // fetch completes before the next one.
  render() {
    if(!this.hass||!this._config||!this._react)return;
    const snap=this.snapshot();this._renderedAgendaEvents=snap.loaded.agenda.events;
    this._react.update(screen(snap));
  }
  zone() { return this.hass?.config?.time_zone||'Europe/Brussels'; }
  detailHistory(id) { return climateHistory(this.hass?.states).filter(h=>h.group===`climate-${id}`); }
  // One Home Assistant card per key (the full calendar, a history graph),
  // made once through HA's card helpers and kept current by `set hass`,
  // placed in the slot React drew for it. When the helpers can't load, the
  // slot says why.
  async attachNative(slot,key,config) {
    try {
      this._helpersPromise ||= window.loadCardHelpers ? window.loadCardHelpers() : Promise.reject(new Error('Card helpers are not ready. Reload the dashboard.'));
      const helpers=await this._helpersPromise;
      if(!slot?.isConnected)return;
      let card=this._native.get(key);
      if(!card){card=helpers.createCardElement(config);this._native.set(key,card);}
      card.hass=this.hass;if(slot.firstElementChild!==card)slot.replaceChildren(card);
    } catch(error) {
      this._helpersPromise=null;
      if(!slot?.isConnected)return;
      const note=document.createElement('p');note.className='note';note.textContent=error?.message||'Unable to load this control.';slot.replaceChildren(note);
    }
  }
  async loadForecast() {
    if(!this.hass||!this.online()||this._forecastLoading||Date.now()-this._forecastTime<30*60000)return;
    this._forecastLoading=true;
    try {
      const result=await this.hass.callWS({type:'call_service',domain:'weather',service:'get_forecasts',service_data:{type:'daily'},target:{entity_id:E.weather},return_response:true});
      this._forecasts=result?.response?.[E.weather]?.forecast||[];
      this._forecastTime=Date.now();this.scheduleRender();
    } catch { this._forecastTime=Date.now()-25*60000; } // Retry after five minutes; current conditions remain useful.
    finally {this._forecastLoading=false;}
  }
  async loadViewData() {
    if(!this.hass||!this.online())return;
    const now=Date.now();
    if(this._page==='today'&&!this._agendaLoading&&(!this._agendaTime||now-this._agendaTime>5*60000)) {
      this._agendaLoading=true;this._agendaTime=now;this.scheduleRender();
      loadAgenda(this.hass,CALENDARS,now,now+7*86400000).then(result=>{this._agenda=result;}).finally(()=>{this._agendaLoading=false;this.scheduleRender();});
    }
    // Energy's chart is today's (v37): from the house's midnight, and loaded
    // again as soon as a new day starts.
    if(this._page==='energy')this.loadHistoryGroup(POWER_HISTORY.group,POWER_HISTORY.ids,dayWindow(now,this.zone()).start);
    if(this._page==='climate'&&this._modal){this.loadHistoryGroup(`climate-${this._modal}`,this.detailHistory(this._modal).flatMap(h=>h.ids));this.loadZoneSchedules(climateSchedules(this._modal));}
  }
  // A scheduled zone's drawer shows today's periods, read with the read-only
  // schedule.get_schedule service: cached 30 minutes, retried after five when
  // it fails. Until then the drawer shows the current period and next change.
  async loadZoneSchedules(ids) {
    if(!this.hass||!this.online())return;
    const now=Date.now();this._schedules||={};this._scheduleTimes||={};this._scheduleRequests||=new Set();
    const due=ids.filter(id=>this.state(id)&&!this._scheduleRequests.has(id)&&now-(this._scheduleTimes[id]||0)>=30*60000);
    if(!due.length)return;
    for(const id of due){this._scheduleRequests.add(id);this._scheduleTimes[id]=now;}
    try {
      const {schedules}=await loadSchedules(this.hass,due);
      for(const id of due){if(schedules[id])this._schedules[id]=schedules[id];else this._scheduleTimes[id]=now-25*60000;}
    } finally {
      for(const id of due)this._scheduleRequests.delete(id);
      this.render();
    }
  }
  // A group's record, kept five minutes: the 24 hours before now, or from a
  // fixed `from`, which a cache starting elsewhere doesn't wait out.
  async loadHistoryGroup(key,ids,from=null) {
    if(!ids.length||!this.hass||!this.online())return;
    const now=Date.now();this._historyRequests||=new Set();this._historyTimes||={};
    const moved=from!==null&&this._historyPages?.[key]?.start!==from;
    if(this._historyRequests.has(key)||(!moved&&this._historyTimes[key]&&now-this._historyTimes[key]<5*60000))return;
    this._historyRequests.add(key);this._historyTimes[key]=now;
    const start=from??now-86400000,end=now;
    this.render();
    try {
      const data=await loadHistory(this.hass,ids,start,end);
      this._historyPages||={};this._historyPages[key]={data,start,end};
    } finally {
      this._historyRequests.delete(key);this.render();
    }
  }
  setFeedback(key,text,clearAfter=0) {
    this._feedback||=new Map();this._feedback.set(key,text);
    this._feedbackTimers||=new Map();clearTimeout(this._feedbackTimers.get(key));
    if(clearAfter){const timer=setTimeout(()=>{if(this._feedback.get(key)===text){this._feedback.delete(key);this.render();}this._feedbackTimers.delete(key);},clearAfter);timer.unref?.();this._feedbackTimers.set(key,timer);}
    // Bound the in-memory UI log; no activity or entity data is persisted.
    if(this._feedback.size>30)this._feedback.delete(this._feedback.keys().next().value);
    this._actionStatus=text;this.render();clearTimeout(this._feedbackTimer);
    if(clearAfter){this._feedbackTimer=setTimeout(()=>{if(this._actionStatus===text){this._actionStatus='';this.render();}},clearAfter);this._feedbackTimer.unref?.();}
  }
  // A request is confirmed only when the entity it watches shows the expected
  // state. After its confirm window the control is released and labelled
  // unconfirmed; a late confirmation is still reported until `keep` runs out.
  reconcileActions() {
    for(const [key,pending] of this._pending||[]) {
      if(pending.accepted&&pending.expected(this.state(pending.watch||key))) {
        clearTimeout(pending.timer);this._pending.delete(key);this._busy.delete(key);
        this.setFeedback(key,`${pending.label} · ${pending.confirmed||'confirmed by Home Assistant'}`,8000);
      } else if(Date.now()-pending.started>(pending.keep||60000)) {clearTimeout(pending.timer);this._pending.delete(key);this._busy.delete(key);}
    }
  }
  // `options` lets a call be confirmed by another entity than the one called,
  // as a script is by the state it changes: key (the busy lock and feedback
  // line), watch, expected, label, confirmMs, and the waiting, confirmed and
  // unconfirmed wording. The house thermostat scripts report success even when
  // they refuse, so only the watched state can confirm them.
  async service(domain,service,entity,data={},options={}) {
    if(!this.online()){this.toast('Home Assistant is disconnected. Try again when it reconnects.');return;}
    if(entity&&!this.valid(entity)){this.toast('This device is unavailable.');return;}
    const key=options.key||entity||domain+'.'+service;
    if(this._busy.has(key))return;
    this._busy.add(key);this._pending||=new Map();
    const expected=options.expected||(entity?expectedOutcome(domain,service,data):null);
    const label=options.label||this.attr(entity,'friendly_name')||pretty(entity?.split('.')[1]||service);
    const confirmMs=options.confirmMs||12000;
    const pending={expected,label,watch:options.watch||key,started:Date.now(),accepted:false,keep:confirmMs+60000,confirmed:options.confirmed};
    this.setFeedback(key,`${label} · sending request…`);
    if(expected)this._pending.set(key,pending);
    this.render();
    try {
      await this.hass.callService(domain,service,{...data,...(entity?{entity_id:entity}:{})});
      if(expected) {
        pending.accepted=true;
        this.setFeedback(key,`${label} · ${options.waiting||'waiting for device update…'}`);
        pending.timer=setTimeout(()=>{
          if(this._pending.get(key)!==pending)return;
          this._busy.delete(key);this.setFeedback(key,`${label} · ${options.unconfirmed||'not yet confirmed. Check its current state before retrying.'}`);
        },confirmMs);
        pending.timer.unref?.();
        this.reconcileActions();
      } else {this._busy.delete(key);this.setFeedback(key,`${label} · request sent`,8000);this.toast('Request sent. Check the device state for the result.');}
    }
    catch(error){this._pending.delete(key);this._busy.delete(key);const text=`Could not complete that action. ${error.message||'Please try again.'}`;this.setFeedback(key,text,12000);this.toast(text);}
    finally{this.render();}
  }
  toast(message) {this._react?.toast(message);}
  // A Home Assistant card in Maison (a .native slot) opening a dialog of its
  // own: an event of the Full calendar (show-dialog), a line of a history
  // graph (hass-more-info). Home Assistant draws that dialog outside Maison,
  // where an open sheet's modal would make it inert, so Maison's dialog and
  // drawer close first. The event is never stopped: Home Assistant still
  // opens its dialog, with nothing inert.
  yieldToCardDialog(event) {
    if(!event.composedPath?.().some(node=>node?.classList?.contains('native')))return;
    if(this._dialog)this.closeDialog();
    if(this._modal&&!this._detailBackPending)this.closeDetail({replace:true});
  }
  moreInfo(entity) {if(this._detailBackPending){this._afterDetailBack=()=>this.moreInfo(entity);return;}this.closeDialog();if(this._modal)this.closeDetail({replace:true});this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:entity},bubbles:true,composed:true}));}
  // The one dialog: {kind: 'alerts'}, {kind: 'event', event} or {kind: 'native', native, chart?}.
  openDialog(dialog) {this._dialog=dialog;this.render();}
  openDetail(id) {
    if(this._detailBackPending){this._afterDetailBack=()=>this.openDetail(id);return;}
    if(!DETAILS.has(`${this._page}/${id}`))return;
    if(!this._modal)this._detailScroll=this.scrollContainers().map(node=>[node,node.scrollTop||0]);
    this._modal=id;this._dialog=null;
    if(location.hash!==`#${this._page}/${id}`)history.pushState({maisonDetail:id,maisonVisit:this._visitId},'',`${location.pathname}${location.search}#${this._page}/${id}`);
    this.render();this.loadViewData();
  }
  // Every press arrives here as an intent, {command, entity?, direction?,
  // value?} (#27). A write or draft goes through only while allowed(), the
  // rule that enables its control; navigation and dialogs act at once.
  async command(intent) {
    const {command,entity}=intent||{};
    if(WRITE_COMMANDS.has(command)) {
      const a=allowed(intent,this.snapshot());if(!a)return;
      // The house card's draft is chosen before it is sent, and spent once sent.
      if(a.draft)this._climate={...this._climate,...a.draft};
      if(a.call)await this.service(a.call.domain,a.call.service,a.call.entity,a.call.data,a.call.options);
      else this.render();
      return;
    }
    switch(command) {
      case 'navigate':this.navigatePage(entity);return;
      // The sensor field is controlled, so a keystroke renders at once or the next one is lost.
      case 'sensor-search':this._sensorQuery=String(intent.value??'');this._sensorLimit=SENSOR_PAGE;this.render();return;
      case 'sensor-category':this._sensorCategory=String(intent.value??'all');this._sensorLimit=SENSOR_PAGE;this.render();return;
      case 'sensor-more':this._sensorLimit=(this._sensorLimit??SENSOR_PAGE)+SENSOR_PAGE;this.render();return;
      case 'agenda-event': {
        if(!/^\d+$/.test(entity))return;const event=this._renderedAgendaEvents?.[Number(entity)];if(!event)return;
        this.openDialog({kind:'event',event});return;
      }
      case 'native-calendar':this.openDialog({kind:'native',native:'calendar'});return;
      case 'native-history':if(historyDefinition(this.hass?.states??{},entity))this.openDialog({kind:'native',native:'history',chart:entity});return;
      case 'detail':this.openDetail(entity);return;
      // The drawer closes as `close detail`; anything else closes the dialog.
      case 'close':if(entity==='detail')this.closeDetail();else this.closeDialog();return;
      case 'more':this.moreInfo(entity);return;
      case 'alerts':this.openDialog({kind:'alerts'});return;
      case 'ha-energy':this.navigateHA('/energy');return;
      case 'ha-settings':this.navigateHA('/config/dashboard');return;
    }
  }
  navigateHA(path) {this.closeDialog();history.pushState(null,'',path);window.dispatchEvent(new Event('location-changed',{bubbles:true,composed:true}));}
}
if(!customElements.get('maison-dashboard'))customElements.define('maison-dashboard',MaisonDashboard);
window.customCards=window.customCards||[];
window.customCards.push({type:'maison-dashboard',name:'Maison',description:'A complete dashboard for this home.',preview:false});
