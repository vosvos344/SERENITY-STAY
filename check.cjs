/* node check.cjs — source/template checks only; does not launch a browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { data, createView, openStays, mapUrls } = require('./app.js');
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
  for (const [, attributes] of html.matchAll(/<iframe\b([^>]+)>/g)) {
    assert.ok(attributes.includes('title="') && attributes.includes('loading="lazy"'));
    assert.ok(attributes.includes('referrerpolicy="no-referrer"'));
    assert.ok(attributes.includes('https://www.openstreetmap.org/export/embed.html?bbox='));
    assert.ok(!attributes.includes('marker='), 'Sample area maps must not imply an exact home pin');
  }
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
  const urls=mapUrls(stay);
  const embed=new URL(urls.embed);
  const bounds=embed.searchParams.get('bbox').split(',').map(Number);
  assert.ok(bounds[0]<stay.map.lng && bounds[2]>stay.map.lng);
  assert.ok(bounds[1]<stay.map.lat && bounds[3]>stay.map.lat);
  assert.equal(embed.searchParams.get('layer'),'mapnik');
  assert.ok(!embed.searchParams.has('marker'));
  assert.ok(urls.external.includes(`${stay.map.lat}/${stay.map.lng}`));
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
  assert.equal((home.match(/<iframe\b/g)||[]).length,1);
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
    assert.equal((detail.match(/<iframe\b/g)||[]).length,1);
    assert.ok(detail.includes(view.booking(stay)));
    assert.equal((detail.match(/airbnb\.co\.kr\/rooms\//g)||[]).length,2);
    assert.ok(!openStays.filter(other=>other!==stay).some(other=>detail.includes(other.listingId)));
    for(const id of ['about','gallery','amenities','location','reserve'])assert.ok(detail.includes(`id="${id}"`));
    assert.equal((detail.match(/<figure>/g)||[]).length,stay.photos.length);
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
assert.ok(app.includes('function setupScrollTracks()') && !app.includes('function setupGallery()'), 'Share the native scrolling controller');
assert.ok(app.includes('if(event.target===track'), 'Arrow keys on child links must not be intercepted');

const homeSource=source('index.html');
assert.ok(homeSource.includes(createView().home()),'Homepage must match generated source');
inspectHTML(homeSource);
for(const stay of openStays){
  const detailSource=source(`stays/${stay.id}.html`);
  assert.ok(detailSource.includes(createView('en','../').detail(stay)),'Detail output must match source');
  assert.ok(detailSource.includes(`<title>${stay.name[0]} — Serenity Stay</title>`));
  inspectHTML(detailSource,'stays');
}
console.log(`PASS — ${Object.keys(data.copy).length} complete EN/KO/ZH text entries; ${inspected} rendered documents inspected.`);
console.log('PASS — 4 real detail pages, exact Airbnb mapping, a non-bookable Coming Soon card, image assets and anchors.');
console.log('PASS — owner introduction, 4 showcase states in 3 languages, three-across scroll rail, 9-card growth fixture.');
console.log('PASS — 4 neighbourhood map configs, sample notices, no exact pins, hover/focus/touch source rules.');
console.log('No browser, screenshot, mobile interaction, or visual QA was performed, as requested.');
