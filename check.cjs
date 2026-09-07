/* node check.cjs — source/template checks only; does not launch a browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { data, createView, openStays, naverMapUrl, escape } = require('./app.js');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const source = filename => fs.readFileSync(path.join(__dirname, filename), 'utf8');
const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr','path','circle','rect']);
let inspected = 0;

function inspectHTML(html, directory = '.') {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate element IDs');
  const stack = [];
  for (const [, closing, tag] of html.matchAll(/<(\/?)([a-zA-Z][\w:-]*)\b[^>]*>/g)) {
    if (voidTags.has(tag)) continue;
    if (closing) assert.equal(stack.pop(), tag, `Unbalanced </${tag}>`);
    else stack.push(tag);
  }
  assert.deepEqual(stack, [], 'Unclosed tags');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, 'One main page heading');
  assert.ok(!/undefined|\[object Object\]|<dialog\b|aria-haspopup="dialog"/.test(html));
  assert.ok(!/<form\b|mailto:|type="email"|subscribe/i.test(html), 'No enquiry/subscription/payment forms');
  for (const [, attributes] of html.matchAll(/<img\b([^>]+)>/g)) assert.ok(/\balt="/.test(attributes), 'Images need alt attributes');
  assert.ok(!/openstreetmap|<iframe\b|data-map-external/i.test(html),'No OpenStreetMap embed, link or fallback');
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(href), `Missing local #${href}`);
  for (const [, href] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    if (/^https:/.test(href)) continue;
    const [resource, anchor] = href.split('#');
    const filename = path.resolve(__dirname, directory, resource.split('?')[0]);
    assert.ok(fs.existsSync(filename), `Missing local resource: ${href}`);
    if (anchor) assert.ok(fs.readFileSync(filename,'utf8').includes(`id="${anchor}"`), `Missing destination anchor: ${href}`);
  }
  for (const [, attributes] of html.matchAll(/<a\b([^>]+)>/g)) {
    if (attributes.includes('target="_blank"')) assert.ok(attributes.includes('rel="noopener noreferrer"'));
  }
  inspected++;
}

for (const [key, tuple] of Object.entries(data.copy)) {
  assert.equal(tuple.length, 3, `Three languages: ${key}`);
  for (const value of tuple) assert.ok(typeof value === 'string' && value.trim(), `Missing translation: ${key}`);
  const placeholders = value => [...value.matchAll(/\{([^}]+)\}/g)].map(match=>match[1]).sort();
  assert.deepEqual(placeholders(tuple[0]),placeholders(tuple[1]),key);
  assert.deepEqual(placeholders(tuple[0]),placeholders(tuple[2]),key);
}
assert.equal(new Set(data.stays.map(stay=>stay.id)).size,data.stays.length);
assert.equal(data.stays.length,5);
assert.equal(openStays.length,4);
assert.equal(data.stays[2].status,'coming-soon','Upcoming is in the first three thumbnail positions');
const expected = {
  mia201:['1726477983734680758','Seoul',13,3,6,2],
  mia202:['1726520220054341394','Seoul',8,2,3,2],
  yeonsin:['1308009905280384993','Seoul',8,3,3,2],
  songdo:['1004921534125532868','Busan',8,3,4,2]
};
for (const stay of data.stays) {
  assert.match(stay.id,/^[a-z0-9-]+$/);
  if (stay.status==='coming-soon') {
    assert.ok(!stay.listingId && !stay.maxGuests && !stay.openingDate);
    continue;
  }
  assert.deepEqual([stay.listingId,stay.city,stay.maxGuests,stay.bedrooms,stay.beds,stay.bathrooms],expected[stay.id]);
  for (const key of ['name','area','tagline','description','alt','storyTitle','sleeping','neighbourhood']) {
    assert.equal(stay[key].length,3);
    stay[key].forEach(text=>assert.ok(text?.trim(),`${stay.id}: ${key}`));
  }
  for (const file of [...stay.photos,stay.cover,stay.storyImage]) assert.ok(fs.statSync(path.join(__dirname,file)).size>1000);
  stay.amenities.forEach(key=>assert.ok(data.copy[key]));
  for(const text of [stay.signature.title,stay.signature.text,stay.map.label]) {
    assert.equal(text.length,3);
    text.forEach(value=>assert.ok(value?.trim()));
  }
  assert.equal(stay.map.kind,'area-sample');
  assert.ok(stay.map.lat>30 && stay.map.lat<40 && stay.map.lng>120 && stay.map.lng<135);
  assert.ok(stay.map.search?.trim());
  const url=new URL(naverMapUrl(stay));
  assert.equal(url.origin,'https://map.naver.com');
  assert.equal(decodeURIComponent(url.pathname),'/p/search/'+stay.map.search);
}

for (const language of ['en','ko','zh']) {
  const homeView=createView(language);
  const home=homeView.home();
  const sections=[...home.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(sections,['top','stays','why','places'],'Requested four-section order');
  const cards=[...home.matchAll(/<article class="stay-card[^>]+>/g)];
  assert.equal(cards.length,5);
  assert.ok(home.includes('id="featured-home"') && home.includes('id="home-rail"'));
  assert.ok(home.includes('id="collection-map"'));
  assert.ok(home.includes('id="collection-map-panel" class="map-scene"'));
  assert.ok(home.includes('class="neighbourhood-map naver-map"'));
  assert.equal((home.match(/data-map-naver/g)||[]).length,1);
  assert.ok(home.includes(homeView.t('mapNotice')));
  assert.ok(home.includes(homeView.t('hostSignature')));
  assert.equal((home.match(/class="benefit reveal"/g)||[]).length,5);
  const future=home.match(/<article class="stay-card upcoming[\s\S]*?<\/article>/)[0];
  assert.ok(!future.includes('<a '),'Coming Soon must not suggest it is bookable');
  inspectHTML(`<main id="main">${home}</main>${homeView.footer()}`);
  for(const stay of openStays){
    const view=createView(language,'../');
    const detail=view.detail(stay);
    const selectedHome=homeView.home(stay);
    assert.ok(selectedHome.includes(`<strong id="map-home-name">${homeView.local(stay.name)}</strong>`));
    assert.ok(selectedHome.includes(homeView.t('mapNotice')));
    inspectHTML(`<main id="main">${selectedHome}</main>${homeView.footer()}`);
    const featured=homeView.showcase(stay);
    assert.equal((featured.match(/<img\b/g)||[]).length,1,'Each showcase uses one full-width cover photo');
    assert.ok(!featured.includes('showcase-detail'),'No cropped secondary photo in the showcase');
    assert.ok(featured.includes(homeView.local(stay.signature.title)));
    assert.ok(featured.includes(`href="stays/${stay.id}.html#location"`));
    assert.ok(detail.includes(view.t('mapNotice')));
    assert.ok(detail.includes('class="location-map map-scene"'));
    const mapHTML=view.mapPanel(stay);
    assert.equal((mapHTML.match(/<a\b/g)||[]).length,1,'One NAVER Map link only');
    assert.ok(mapHTML.includes(naverMapUrl(stay)) && mapHTML.includes(escape(view.t('mapUnavailable'))));
    assert.ok(mapHTML.includes('class="neighbourhood-map map-placeholder" role="status"'));
    assert.equal((detail.match(/data-map-naver/g)||[]).length,1);
    assert.ok(detail.includes(view.booking(stay)));
    assert.equal((detail.match(/airbnb\.co\.kr\/rooms\//g)||[]).length,2);
    assert.ok(!openStays.filter(other=>other!==stay).some(other=>detail.includes(other.listingId)));
    for(const id of ['about','gallery','amenities','location','reserve'])assert.ok(detail.includes(`id="${id}"`));
    assert.equal((detail.match(/<figure>/g)||[]).length,stay.photos.length);
    assert.equal((detail.match(/class="gallery-photo"/g)||[]).length,stay.photos.length, 'Each gallery photo has a stable zoom frame');
    assert.equal((detail.match(/class="motion-title"/g)||[]).length,5, 'All detail section titles use the shared line renderer');
    inspectHTML(`<main id="main">${detail}</main>${view.footer()}`,'stays');
  }
  const missing=homeView.detail(null);
  assert.ok(missing.includes(homeView.t('notFound')) && !missing.includes('airbnb.co.kr/rooms/'));
}

// Simulate a larger collection by loading the same templates with in-memory data.
// This does not change real records or publish any fictional accommodation.
const expanded=structuredClone(data);
for(let n=0;n<4;n++)expanded.stays.push({...structuredClone(openStays[0]),id:`growth-fixture-${n}`});
const sandbox={module:{exports:{}},require:()=>expanded};
vm.runInNewContext(app,sandbox);
const growing=sandbox.module.exports.createView().home();
assert.equal((growing.match(/<article class="stay-card/g)||[]).length,9);
assert.ok(growing.includes('8 homes · 1 coming soon'));
assert.ok(!/stay-card:nth-child/.test(css),'No item-count-specific staggering');
assert.ok(css.includes('grid-auto-columns: calc((100% - 48px) / 3)'));
assert.ok(css.includes('scroll-snap-type: x mandatory'));
assert.ok(!css.includes('.stays-grid'), 'The old two-row listing layout was replaced, not layered over');
assert.ok(!css.includes('.showcase-detail'),'No obsolete secondary-photo responsive styles');
assert.ok(css.includes('.destination-photo:hover .destination-overlay { opacity: 0;'));
assert.ok(css.includes('.destination-photo:focus-visible .destination-overlay { opacity: 0;'));
assert.ok(css.includes('@media (hover: hover) and (pointer: fine)'));
assert.ok(css.includes('.destination-hover-cta'));
assert.ok(css.includes('max-width: 960px') && css.includes('max-width: 540px'));
assert.ok(css.includes('prefers-reduced-motion: reduce'));
assert.ok(css.includes('@keyframes title-rise') && css.includes('@keyframes ken-burns'));
assert.ok(app.includes('7200') && app.includes('visibilitychange') && app.includes('clearTimeout(timer)'));
assert.ok(!/showModal|stay-dialog|preventDefault\(\).*showModal/.test(app));
assert.ok(!/https?:\/\//.test(css),'No font/image CDN dependency');
assert.ok(!/position:\s*(absolute|fixed)/.test(css.replace(/\.sr-only \{[^}]+\}/,'').replace(/\.skip-link \{[^}]+\}/,'')));
assert.ok(!app.includes('history.pushState'),'Detail pages use real browser navigation');
assert.ok(!/openstreetmap|mapUrls|mapOpen|data-map-external/i.test(app+source('content.js')+css),'Removed provider is not requested or rendered anywhere');
assert.ok(!app.includes('new maps.Marker'),'Sample maps must not imply an exact accommodation pin');
assert.ok(app.includes('function setupScrollTracks()') && !app.includes('function setupGallery()'), 'Share the native scrolling controller');
assert.ok(app.includes('if(event.target===track'), 'Arrow keys on child links must not be intercepted');

// Replace scroll-progress fades; the browser owns timed/reversible transitions.
assert.ok(!/animateSections|cleanupMotion|is-entering|media-reveal|--order/.test(app));
assert.ok(!/is-entering|content-enter|photo-enter|detail-enter|city-settle/.test(css));
assert.ok(css.includes('@media screen and (prefers-reduced-motion: no-preference)'));
assert.ok(!/scroll-enter|photo-depth|--enter-shift|--enter-scale|@keyframes (title|copy|frame|photo)-unfold|animation-timeline: --(title|photo)/.test(css));
const entranceCSS=css.slice(css.indexOf('@media screen and (prefers-reduced-motion: no-preference)'),css.indexOf('@keyframes title-rise'));
assert.ok(!/opacity|filter|visibility|display|animation-timeline/.test(entranceCSS),'No fog, hiding photos or scroll scrubbing in entrance rules');
assert.ok(entranceCSS.includes('clip-path: inset(0 11% 0 11%)'), 'A photo is never completely masked');
assert.ok(entranceCSS.includes('scale: 1.22') && entranceCSS.includes('scale: 1;'));
assert.ok(entranceCSS.includes('transform 1.05s') && entranceCSS.includes('scale 1.45s'));
assert.ok(entranceCSS.includes('var(--line-index) * 110ms') && entranceCSS.includes('var(--sequence) * 130ms'));
assert.ok(entranceCSS.includes('.map-scene.motion-active > .map-panel { translate: 0 0; }'));
assert.ok(entranceCSS.includes('.gallery-track.motion-active > .frame-active .gallery-photo'));
assert.ok(entranceCSS.includes('.home-rail.motion-active > .stay-card.frame-active'));
assert.ok(/\.home-rail\.motion-ready > \.stay-card \{[^}]*transform-origin: left bottom;/.test(css),'Card motion preserves the left edge used by native arrow navigation');
assert.ok(/\.gallery-section \{[^}]*overflow: clip;/.test(css));
for(const selector of ['home-rail','gallery-track']) {
  assert.ok(new RegExp(`\\.${selector} \\{[^}]*overflow-x: auto;[^}]*scrollbar-width: none;`).test(css));
}

// Run the actual controller with a tiny DOM/observer double (no packages).
// Browser rendering/timing still needs the separate real-preview check.
const makeTarget=top=>{
  const classes=new Set();
  return {isConnected:true,children:[],classes,matches:()=>false,getBoundingClientRect:()=>({top}),
    classList:{add:name=>classes.add(name),remove:(...names)=>names.forEach(name=>classes.delete(name)),
      toggle:(name,on)=>on?classes.add(name):classes.delete(name)}};
};
let scenes=[makeTarget(900),makeTarget(-200)];
const observers=[];
class ObserverDouble {
  constructor(callback,options){this.callback=callback;this.options=options;this.targets=new Set();observers.push(this);}
  observe(target){this.targets.add(target);}
  unobserve(target){this.targets.delete(target);}
  disconnect(){this.targets.clear();}
}
const resizeHandlers=new Set();
const motionContext={document:{querySelectorAll:()=>scenes},IntersectionObserver:ObserverDouble,
  window:{innerHeight:1000,IntersectionObserver:ObserverDouble,addEventListener:(_,fn)=>resizeHandlers.add(fn),removeEventListener:(_,fn)=>resizeHandlers.delete(fn)}};
const controller=app.slice(app.indexOf('  function setupEntrances()'),app.indexOf('  function showMap('));
vm.runInNewContext(`let cleanupEntrances=()=>{}, refreshEntrances=()=>{};const reduceMotion={matches:false};${controller}setupEntrances();`,motionContext);
assert.equal(observers[0].options.rootMargin,'0px 0px -150px 0px');
assert.ok(!scenes[0].classes.has('motion-active') && scenes[1].classes.has('motion-active'));
const cross=top=>observers.at(-1).callback([{target:scenes[0],boundingClientRect:{top},rootBounds:{bottom:850}}]);
cross(849);assert.ok(scenes[0].classes.has('motion-active'),'Forward at 85%');
cross(-300);assert.ok(scenes[0].classes.has('motion-active'),'No reverse when leaving at the top');
cross(851);assert.ok(!scenes[0].classes.has('motion-active'),'Reverse at the same boundary');
cross(840);assert.ok(scenes[0].classes.has('motion-active'),'Replay after reversing');
const detached=scenes[0];detached.isConnected=false;scenes=[makeTarget(700),scenes[1]];
vm.runInNewContext('refreshEntrances()',motionContext);
assert.ok(!observers[0].targets.has(detached) && observers[0].targets.has(scenes[0]),'Register replaced showcase without touching existing scenes');
assert.ok(scenes[0].classes.has('motion-active'),'Visible replacement content is immediately readable');
motionContext.window.innerHeight=800;[...resizeHandlers][0]();
assert.equal(observers.at(-1).options.rootMargin,'0px 0px -120px 0px');
vm.runInNewContext('reduceMotion.matches=true;setupEntrances()',motionContext);
assert.equal(resizeHandlers.size,0);
assert.ok(scenes.every(scene=>!scene.classes.has('motion-ready')),'Reduced motion removes transforms and masks');
vm.runInNewContext('reduceMotion.matches=false;delete window.IntersectionObserver;setupEntrances()',motionContext);
assert.ok(scenes.every(scene=>!scene.classes.has('motion-ready')),'No observer means readable static content');

// Exercise the actual shared rail controller: arrow entry, lazy load and replay.
const trackEvents={}, railResize=new Set();
const track={id:'fixture',scrollLeft:0,clientWidth:200,scrollWidth:430,
  getBoundingClientRect:()=>({left:0,right:200}),
  addEventListener:(type,fn)=>trackEvents[type]=fn,removeEventListener:type=>delete trackEvents[type],
  scrollTo({left,behavior}){this.scrollLeft=Math.max(0,Math.min(230,left));this.behavior=behavior;trackEvents.scroll();}};
const photos=Array.from({length:4},()=>({naturalWidth:900,events:{},
  addEventListener(type,fn){this.events[type]=fn;},removeEventListener(type){delete this.events[type];}}));
photos[2].naturalWidth=0;
track.children=photos.map((photo,i)=>({...makeTarget(0),offsetWidth:100,
  getBoundingClientRect:()=>({left:i*110-track.scrollLeft}),querySelector:()=>photo}));
track.querySelectorAll=()=>photos;
const railButtons=[{dataset:{scrollStep:'-1'}},{dataset:{scrollStep:'1'}}];
const trackContext={window:{addEventListener:(_,fn)=>railResize.add(fn),removeEventListener:(_,fn)=>railResize.delete(fn)},
  document:{querySelectorAll:selector=>selector==='[data-scroll-track]'?[track]:railButtons},getComputedStyle:()=>({paddingLeft:'0'})};
const trackController=app.slice(app.indexOf('  function setupScrollTracks()'),app.indexOf('  // Observe stationary'));
vm.runInNewContext(`let cleanupTracks;const reduceMotion={matches:false};${trackController}setupScrollTracks();`,trackContext);
const activeFrames=()=>track.children.map(frame=>frame.classes.has('frame-active'));
assert.deepEqual(activeFrames(),[true,true,false,false]);
railButtons[1].onclick();
assert.equal(track.scrollLeft,110);assert.equal(track.behavior,'smooth');
assert.deepEqual(activeFrames(),[false,true,false,false],'Next image waits until its photo loads');
photos[2].naturalWidth=900;photos[2].events.load();
assert.deepEqual(activeFrames(),[false,true,true,false]);
railButtons[1].onclick();assert.deepEqual(activeFrames(),[false,false,true,true],'Offscreen frames re-arm');
railButtons[0].onclick();assert.deepEqual(activeFrames(),[false,true,true,false],'Previous replays the returning frame');
vm.runInNewContext('reduceMotion.matches=true',trackContext);
trackEvents.keydown({target:track,key:'ArrowLeft',preventDefault(){}});
assert.equal(track.scrollLeft,0);assert.equal(track.behavior,'auto');
assert.deepEqual(activeFrames(),[true,true,false,false]);
vm.runInNewContext('cleanupTracks()',trackContext);
assert.equal(railResize.size,0);assert.equal(Object.keys(trackEvents).length,0);
assert.ok(photos.every(photo=>!Object.keys(photo.events).length));

// SDK calls are mocked: no network, no account keys and no billable API requests.
const mapController=app.slice(app.indexOf('  let naverReady'),app.indexOf('  async function stepShowcase'));
const mapFixture=clientId=>{
  const scripts=[],instances=[];
  const makeHost=id=>{
    const placeholder={hidden:false};
    const panel={dataset:{mapStay:id},querySelector:selector=>{assert.equal(selector,'.map-placeholder');return placeholder;}};
    return {hidden:true,closest:()=>panel,placeholder,panel};
  };
  const maps={LatLng:class{constructor(lat,lng){this.lat=lat;this.lng=lng;}},Map:class{
    constructor(host,options){this.host=host;this.options=options;instances.push(this);}
    setCenter(center){this.options.center=center;}
    destroy(){this.destroyed=true;}
  }};
  const context={SERENITY_MAP_CONFIG:{clientId},openStays,window:{naver:{maps}},host:makeHost('mia201')};
  context.document={querySelector:()=>context.host,createElement:()=>({}),head:{append:script=>scripts.push(script)}};
  vm.runInNewContext(mapController+';globalThis.sync=syncNaverMap;globalThis.cleanup=cleanupMap;',context);
  return {context,scripts,instances,makeHost};
};
async function checkMaps(){
  const empty=mapFixture('');await empty.context.sync();
  assert.equal(empty.scripts.length,0);assert.ok(!empty.context.host.placeholder.hidden);
  const f=mapFixture('test-public-id');
  const first=f.context.sync(),second=f.context.sync();
  assert.equal(f.scripts.length,1,'SDK requested only once while pending');
  const sdk=new URL(f.scripts[0].src);
  assert.equal(sdk.origin,'https://oapi.map.naver.com');
  assert.equal(sdk.searchParams.get('ncpKeyId'),'test-public-id');
  assert.equal(sdk.searchParams.get('language'),'en');
  assert.equal(sdk.searchParams.get('callback'),'serenityMapsReady');
  assert.ok(!/secret/i.test(sdk.search),'No Secret in browser requests');
  f.context.host.panel.dataset.mapStay='songdo';
  f.context.window.serenityMapsReady();await Promise.all([first,second]);
  assert.equal(f.instances.length,1,'Pending calls reuse one map and newest location');
  assert.equal(f.instances[0].options.center.lat,35.077);
  assert.equal(f.instances[0].options.scrollWheel,false);
  assert.ok(f.context.host.placeholder.hidden && !f.context.host.hidden);
  f.context.host.panel.dataset.mapStay='yeonsin';await f.context.sync();
  assert.equal(f.instances.length,1);assert.equal(f.instances[0].options.center.lat,37.619);
  f.context.cleanup();f.context.host=f.makeHost('mia202');await f.context.sync();
  assert.ok(f.instances[0].destroyed);assert.equal(f.instances.length,2);assert.equal(f.scripts.length,1);
  f.context.window.navermap_authFailure();await f.context.sync();
  assert.ok(f.instances[1].destroyed && !f.context.host.placeholder.hidden && f.context.host.hidden,'Late auth failure shows the local notice only');
  const fail=mapFixture('test-public-id'),pending=fail.context.sync();
  fail.scripts[0].onerror();await pending;assert.equal(fail.instances.length,0);assert.ok(!fail.context.host.placeholder.hidden);
  const stale=mapFixture('test-public-id'),old=stale.context.sync();
  stale.context.host=stale.makeHost('songdo');const latest=stale.context.sync();
  stale.context.window.serenityMapsReady();await Promise.all([old,latest]);
  assert.equal(stale.instances.length,1);assert.equal(stale.instances[0].host,stale.context.host,'No map in a replaced language DOM');
  const broken=mapFixture('test-public-id');broken.context.window.naver.maps.Map=class{constructor(){throw Error('SDK failure');}};
  const brokenLoad=broken.context.sync();broken.context.window.serenityMapsReady();await brokenLoad;
  assert.ok(broken.context.host.hidden && !broken.context.host.placeholder.hidden,'Constructor failure shows the local notice only');
  console.log('PASS — shared rail entry/loading/replay/cleanup; SDK blank/success/reuse/failure/stale-DOM checks (mocked, no network).');
}
checkMaps().catch(error=>{console.error(error);process.exitCode=1;});

const homeSource=source('index.html');
assert.ok(homeSource.includes(createView().home()),'Homepage must match generated source');
inspectHTML(homeSource);
for(const stay of openStays){
  const detailSource=source(`stays/${stay.id}.html`);
  assert.ok(detailSource.includes('../styles.css?v=12') && detailSource.includes('../app.js?v=12') && detailSource.includes('../map-config.js?v=12'), 'Shared updated assets on every detail page');
  assert.ok(detailSource.includes(createView('en','../').detail(stay)),'Detail output must match source');
  assert.ok(detailSource.includes(`<title>${stay.name[0]} — Serenity Stay</title>`));
  inspectHTML(detailSource,'stays');
}
console.log(`PASS — ${Object.keys(data.copy).length} complete EN/KO/ZH text entries; ${inspected} rendered documents inspected.`);
console.log('PASS — 4 real detail pages, exact Airbnb mapping, a non-bookable Coming Soon card, image assets and anchors.');
console.log('PASS — owner introduction, 4 showcase states in 3 languages, three-across scroll rail, 9-card growth fixture.');
console.log('PASS — 4 neighbourhood map configs, sample notices, no exact pins, hover/focus/touch source rules.');
console.log('PASS — timed non-fading entrance rules; 85% trigger/reverse/replay; replacement, resize and static-fallback controller checks.');
console.log('This check runs source/template validation only; it does not launch a browser.');
