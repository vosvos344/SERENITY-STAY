/* node check.cjs — no dependencies. Add --browser with an existing Playwright + Chrome installation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = __dirname;
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const context = { window: {} };
vm.runInNewContext(read('content.js'), context);
const site = context.window.SERENITY;
const html = read('index.html');
for (const locale of Object.values(site.copy)) {
  assert.deepEqual(Object.keys(locale).sort(), Object.keys(site.copy.en).sort(), 'Translation keys must match');
  for (const [, key] of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) assert.ok(locale[key], `Missing translation: ${key}`);
}
assert.equal(new Set(site.stays.map((stay) => stay.id)).size, site.stays.length, 'Property IDs must be unique');
assert.equal('latitude' in site.map || 'longitude' in site.map, false, 'Coordinates belong to each stay, never the shared map settings');
for (const stay of site.stays) {
  assert.ok(Object.hasOwn(stay, 'location'), 'Every stay explicitly defines its location or null');
  assert.ok(fs.existsSync(path.join(root, stay.cover)), stay.cover);
  assert.ok(site.copy.en[stay.intro]);
  if (stay.status === 'soon') { assert.equal(stay.airbnb, null); continue; }
  assert.equal(new URL(stay.airbnb).hostname, 'www.airbnb.co.kr');
  assert.ok(stay.guests > 0 && stay.bedrooms > 0 && stay.baths > 0);
  assert.ok(stay.photos.length > 0);
  for (const [photo, caption] of stay.photos) {
    assert.ok(fs.existsSync(path.join(root, photo)), photo);
    for (const copy of Object.values(site.copy)) assert.ok(copy[caption], caption);
  }
}
for (const [, asset] of html.matchAll(/(?:src|href)="(assets\/[^"?#]+)"/g)) assert.ok(fs.existsSync(path.join(root, asset)), asset);
for (const slide of site.hero.slides) assert.ok(fs.existsSync(path.join(root, slide.src)), slide.src);
assert.equal(site.stays.filter((stay) => stay.status === 'open').length, 2);
assert.equal(site.stays.find((stay) => stay.id === 'mia201').guests, 13);
assert.equal(site.stays.find((stay) => stay.id === 'mia202').guests, 7);
console.log('PASS: translations, local assets, property data, and reservation destinations');

async function checkBrowser() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const base = process.env.SERENITY_TEST_URL || 'http://127.0.0.1:4173';
  const snapshots = path.join(root, 'screenshots');
  fs.mkdirSync(snapshots, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(base + '/?lang=en', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.stay-card').count(), 3);
    const heroBounds = await page.locator('.hero-stage').boundingBox();
    assert.equal(heroBounds.width, 1440, 'The media banner fills the viewport width');
    assert.equal(heroBounds.height, 900, 'The hero fills the first screen below the masthead');
    assert.equal(await page.locator('#hero-pause').getAttribute('aria-pressed'), 'true');
    await page.locator('#hero-next').click();
    assert.equal(await page.locator('#hero-current').textContent(), '02');
    await page.locator('#hero-prev').click();
    assert.equal(await page.locator('#hero-current').textContent(), '01');
    await page.locator('[data-filter="busan"]').click();
    assert.equal(await page.locator('.stay-card:visible').count(), 1);
    assert.equal(await page.locator('.stay-card:visible a').count(), 0, 'Coming-soon stays must not be bookable');
    assert.equal(await page.locator('.soon-cover-title strong').innerText(), 'COMING\nSOON');
    assert.ok(await page.locator('.soon-cover-title strong').evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 60), 'Coming soon is prominent on the photograph');
    await page.locator('.stay-card.soon').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(snapshots, 'busan-coming-soon.png') });
    await page.locator('[data-filter="seoul"]').click();
    assert.equal(await page.locator('.stay-card:visible').count(), 2);
    await page.locator('[data-open-stay="mia201"]').first().click();
    assert.equal(await page.locator('dialog').evaluate((el) => el.open), true);
    assert.equal(await page.locator('#dialog-title').textContent(), 'Mia 201');
    assert.ok((await page.locator('#dialog-book').getAttribute('href')).includes('1726477983734680758'));
    assert.equal(await page.locator('#gallery-thumbs button').count(), 8);
    assert.equal(await page.locator('dialog').evaluate(el => el.scrollHeight === el.clientHeight), true, 'No whole-dialog scrollbar on desktop');
    await page.locator('#tab-rooms').click();
    assert.equal(await page.locator('#dialog-rooms .room-row').count(), 3);
    const beforeTabNavigation = await page.locator('#dialog-photo').getAttribute('src');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-amenities').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#dialog-photo').getAttribute('src'), beforeTabNavigation, 'Tab arrows do not move the photo');
    assert.equal(await page.locator('.detail-content').evaluate(el => getComputedStyle(el).scrollbarWidth), 'thin');
    await page.locator('#tab-guide').click();
    assert.equal(await page.locator('#panel-guide .house-rules li').count(), 4);
    await page.locator('#tab-overview').click();
    await page.locator('#gallery-thumbs button').nth(2).click();
    assert.equal(await page.locator('#gallery-thumbs button').nth(2).getAttribute('aria-pressed'), 'true');
    const initialPhoto = await page.locator('#dialog-photo').getAttribute('src');
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await page.locator('#dialog-photo').getAttribute('src'), initialPhoto);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').evaluate((el) => el.open), false);
    assert.ok(await page.locator('[data-open-stay="mia201"]').first().evaluate((el) => el === document.activeElement), 'Focus returns to gallery trigger');
    await page.locator('[data-open-stay="mia202"]').first().click();
    assert.ok((await page.locator('#dialog-book').getAttribute('href')).includes('1726520220054341394'));
    await page.screenshot({ path: path.join(snapshots, 'stay-details.png') });
    await page.keyboard.press('Escape');
    await page.locator('[data-filter="all"]').click();
    const dimensions = [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 740 }];
    for (const locale of ['en', 'zh', 'ko']) {
      await page.locator('#language').selectOption(locale);
      assert.equal(await page.locator('html').getAttribute('lang'), { en: 'en', zh: 'zh-CN', ko: 'ko' }[locale]);
      for (const dimension of dimensions) {
        await page.setViewportSize(dimension);
        const overflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
        assert.ok(overflow.document <= overflow.viewport + 1, `${locale} overflow at ${dimension.width}: ${JSON.stringify(overflow)}`);
      }
      await page.setViewportSize({ width: 1280, height: 600 });
      await page.locator('[data-open-stay="mia201"]').first().click();
      const readingHeight = await page.locator('.detail-content').evaluate(el => el.getBoundingClientRect().height);
      assert.ok(readingHeight > 120, `${locale}: short laptop screen must retain a usable reading pane (${readingHeight}px)`);
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#language').selectOption('en');
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(snapshots, 'mobile.png') });
    await page.locator('.menu-toggle').click();
    assert.equal(await page.locator('#mobile-nav').isVisible(), true);
    await page.locator('#mobile-nav a[href="#stays"]').click();
    assert.equal(await page.locator('#mobile-nav').isVisible(), false);
    await page.locator('[data-open-stay="mia202"]').first().click();
    assert.equal(await page.locator('#dialog-book').isVisible(), true);
    assert.equal((await page.locator('dialog').boundingBox()).width, 390, 'Mobile detail sheet fills the viewport');
    await page.locator('#tab-rooms').click();
    assert.equal(await page.locator('#dialog-rooms .room-row').count(), 2);
    await page.locator('#dialog-book').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#dialog-book').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight));
    await page.screenshot({ path: path.join(snapshots, 'mobile-details.png') });
    await page.keyboard.press('Escape');
    await page.locator('#questions details').first().locator('summary').click();
    assert.equal(await page.locator('#questions details').first().getAttribute('open'), '');
    await page.locator('#neighborhood').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.querySelector('#naver-map').hidden || !document.querySelector('#map-status').textContent.includes('Finding'), { timeout: 18000 });
    console.log('MAP:', await page.locator('#naver-map').isVisible() ? 'map initialized' : 'selected stay’s location notice');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(snapshots, 'desktop.png') });
    await page.screenshot({ path: path.join(snapshots, 'full-page.png'), fullPage: true });
    // Reversible motion is checked at identical positions in both directions.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#language').selectOption('en');
    const portalTop = await page.locator('.portal-stage').evaluate((el) => el.getBoundingClientRect().top + scrollY);
    async function samplePortal(y) {
      await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), y);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return page.locator('.portal-stage').evaluate((el) => ({ progress: Number(el.style.getPropertyValue('--portal')), clip: getComputedStyle(el.querySelector('.portal-visual')).clipPath }));
    }
    const portalStart = await samplePortal(portalTop - 700);
    const portalExpanded = await samplePortal(portalTop - 50);
    const portalReversed = await samplePortal(portalTop - 700);
    assert.ok(portalExpanded.progress > portalStart.progress + .5, `Portal visibly expands with scroll: ${JSON.stringify({portalStart, portalExpanded, portalReversed})}`);
    assert.notEqual(portalExpanded.clip, portalStart.clip);
    assert.ok(Math.abs(portalReversed.progress - portalStart.progress) < .002, 'Reverse scroll restores the exact portal state');
    const revealTop = await page.locator('.intro-bottom').evaluate((el) => el.getBoundingClientRect().top + scrollY);
    for (const offset of [1050, 400, 1050, 400]) {
      await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), revealTop - offset);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const progress = await page.locator('.intro-bottom').evaluate((el) => Number(el.style.getPropertyValue('--reveal')));
      assert.equal(progress, offset === 1050 ? 0 : 1, 'Text resets and reveals on every pass');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#stays').scrollIntoViewIfNeeded();
    const railBefore = await page.locator('#stay-grid').evaluate((el) => ({ card: el.firstElementChild.getBoundingClientRect().width, height: el.getBoundingClientRect().height, scroll: el.scrollWidth }));
    // Temporary browser-only data: prove 12 properties do not shrink the cards or add page rows.
    await page.evaluate(() => {
      const original = [...SERENITY.stays];
      SERENITY.stays.push(...Array.from({ length: 9 }, (_, i) => ({ ...original[i % 3], id: `test-stay-${i}` })));
      document.querySelector('#language').dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(100);
    const railAfter = await page.locator('#stay-grid').evaluate((el) => ({ card: el.firstElementChild.getBoundingClientRect().width, height: el.getBoundingClientRect().height, scroll: el.scrollWidth }));
    assert.equal(await page.locator('.stay-card').count(), 12);
    assert.equal(railBefore.card, railAfter.card, 'Card width stays identical with 3 or 12 stays');
    assert.equal(railBefore.height, railAfter.height, 'More stays do not grow the collection vertically');
    assert.ok(railAfter.scroll > railBefore.scroll * 3);
    for (let i = 0; i < 11; i++) { await page.locator('#stay-next').click(); await page.waitForTimeout(70); }
    assert.equal(await page.locator('#rail-current').textContent(), '12');
    assert.equal(await page.locator('#stay-next').isDisabled(), true);
    await page.locator('#stay-grid').focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#rail-current').textContent(), '11');
    console.log(`PASS: reversible scroll + repeated reveal; 3 → 12 stays keep ${railAfter.card}px card width and ${railAfter.height}px rail height`);
    // Reload discards all temporary properties before any final screenshots.
    await page.goto(base + '/?lang=en', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(snapshots, 'desktop.png') });
    await page.locator('#stays').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(snapshots, 'stay-collection.png') });
    await page.locator('#neighborhood').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(snapshots, 'full-page.png'), fullPage: true });
    // A stay without confirmed coordinates must not inherit another stay's map.
    await page.goto(base + '/?lang=zh', { waitUntil: 'networkidle' });
    await page.locator('#map-stay').selectOption('busan');
    assert.equal(await page.locator('#naver-map').isVisible(), false);
    assert.equal(await page.locator('#map-external-link').isVisible(), false);
    assert.equal(await page.locator('#map-fallback-link').isVisible(), false);
    // Exercise the optional video configuration with an unavailable file: poster must recover.
    await page.route('**/content.js*', (route) => route.fulfill({ contentType: 'application/javascript', body: read('content.js') + '\nwindow.SERENITY.hero.type="video";window.SERENITY.hero.src="assets/not-supplied.mp4";' }));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(base + '/?lang=en', { waitUntil: 'networkidle' });
    await page.waitForSelector('#hero-media img.is-active');
    assert.equal(await page.locator('#hero-media img').getAttribute('src'), site.hero.poster);
    assert.equal(await page.locator('#hero-pause').isVisible(), false);
    assert.deepEqual(errors, [], 'No uncaught JavaScript errors');
    console.log('PASS: 3 languages × 4 widths, stay rail, gallery, keyboard, focus, menu, FAQ, map fallback, video fallback, reduced motion and reverse scroll');
  } finally { await browser.close(); }
}


async function checkMaps() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const base = process.env.SERENITY_TEST_URL || 'http://127.0.0.1:4173';
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Coordinates are test inputs only. They never enter the property data on disk.
  const fixture = read('content.js') + `
    SERENITY.stays[0].location = { precision:'exact', latitude:37.60, longitude:127.0, address:'TEST ONLY · Location 01', naverUrl:'https://map.naver.com/p/search/TEST-01' };
    SERENITY.stays[1].location = { precision:'area', latitude:37.50, longitude:126.90, address:'TEST ONLY · Location 02', naverUrl:'https://map.naver.com/p/search/TEST-02' };
  `;
  const sdk = `
    window.__mapTest = { maps:[], markers:[], circles:[] };
    class LatLng { constructor(lat,lng){ this.lat=lat; this.lng=lng; } }
    class MockMap { constructor(id,options){ this.center=options.center; __mapTest.maps.push(this); } setSize(size){ this.size=size; } updateBy(center,zoom){ this.center=center; this.zoom=zoom; } }
    class Marker { constructor(options){ this.options=options; __mapTest.markers.push(this); } setOptions(options){ this.options=options; } setMap(map){ this.map=map; } }
    class Circle { constructor(options){ this.center=options.center; __mapTest.circles.push(this); } setCenter(center){ this.center=center; } setMap(map){ this.map=map; } }
    class Point { constructor(x,y){ this.x=x; this.y=y; } }
    window.naver = { maps:{Map:MockMap,Marker,Circle,LatLng,Point,Size:Point,Position:{TOP_RIGHT:1}} };
  `;
  try {
    await page.goto(base + '/?lang=en', { waitUntil:'networkidle' });
    assert.equal(await page.locator('#map-stay option').count(), site.stays.length);
    for (const stay of site.stays) {
      await page.locator('#map-stay').selectOption(stay.id);
      assert.equal(await page.locator('#map-stay-name').textContent(), stay.name);
      if (!stay.location) assert.equal(await page.locator('#naver-map').isVisible(), false);
    }
    // Detail → location selects the correct stay and hands keyboard focus to the selector.
    await page.locator('[data-open-stay="mia202"]').first().click();
    await page.locator('#tab-guide').click();
    await page.locator('#dialog-show-map').click();
    assert.equal(await page.locator('#map-stay').inputValue(), 'mia202');
    assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
    assert.equal(await page.locator('#map-stay').evaluate(el => el === document.activeElement), true);
    for (const lang of ['en','zh','ko']) {
      await page.locator('#language').selectOption(lang);
      assert.equal(await page.locator('#map-stay').inputValue(), 'mia202');
      for (const width of [1440,768,390,320]) {
        await page.setViewportSize({width,height:900});
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${lang}: location UI overflow at ${width}px`);
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#language').selectOption('en');
    await page.locator('#neighborhood').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(root,'screenshots','locations.png')});
    await page.setViewportSize({width:390,height:844});
    await page.locator('#neighborhood').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(root,'screenshots','locations-mobile.png')});
    await page.route('**/content.js*', route => route.fulfill({contentType:'application/javascript',body:fixture}));
    let sdkRequests = 0;
    await page.route('**/openapi/v3/maps.js*', async route => {
      sdkRequests++;
      await new Promise(resolve => setTimeout(resolve,350));
      await route.fulfill({contentType:'application/javascript',body:sdk});
    });
    await page.goto(base + '/?lang=en', {waitUntil:'networkidle'});
    await page.locator('#map-stay').selectOption('mia202');
    await page.locator('#map-stay').selectOption('busan');
    await page.waitForFunction(() => window.__mapTest);
    assert.equal(await page.evaluate(() => __mapTest.maps.length), 0, 'A pending choice made during SDK loading must stay map-free');
    await page.locator('#map-stay').selectOption('mia202');
    assert.deepEqual(await page.evaluate(() => __mapTest.maps[0].center), {lat:37.5,lng:126.9});
    assert.equal(await page.evaluate(() => Boolean(__mapTest.circles[0].map)), true, 'Approximate locations use an area circle');
    await page.locator('#map-stay').selectOption('mia201');
    assert.deepEqual(await page.evaluate(() => __mapTest.maps[0].center), {lat:37.6,lng:127});
    assert.equal(await page.evaluate(() => __mapTest.maps.length), 1, 'Reuse one map while switching properties');
    assert.equal(await page.evaluate(() => __mapTest.circles[0].map), null, 'Exact location clears the previous area circle');
    assert.equal(await page.locator('#map-external-link').getAttribute('href'), 'https://map.naver.com/p/search/TEST-01');
    await page.locator('#map-stay').selectOption('busan');
    assert.equal(await page.evaluate(() => __mapTest.markers[0].map), null);
    assert.equal(await page.locator('#naver-map').isVisible(), false);
    assert.equal(await page.locator('#map-external-link').isVisible(), false);
    await page.locator('#language').selectOption('zh');
    assert.equal(await page.locator('#map-stay').inputValue(), 'busan');
    await page.locator('#map-stay').selectOption('mia202');
    await page.evaluate(() => window.navermap_authFailure());
    assert.equal(await page.locator('#naver-map').isVisible(), false);
    assert.equal(await page.locator('#map-fallback-link').getAttribute('href'), 'https://map.naver.com/p/search/TEST-02');
    assert.equal(await page.locator('#map-status').textContent(), site.copy.zh.mapUnavailable);
    assert.equal(sdkRequests, 1);
    await page.evaluate(() => { SERENITY.stays[0].location.latitude=91; SERENITY.stays.push(...Array.from({length:9},(_,i)=>({...SERENITY.stays[1],id:'map-test-'+i}))); });
    await page.locator('#language').selectOption('en');
    assert.equal(await page.locator('#map-stay option').count(),12);
    await page.locator('#map-stay').selectOption('mia201');
    assert.equal(await page.locator('#map-status').textContent(),site.copy.en.mapPending,'Invalid coordinates are never plotted');
    assert.deepEqual(errors,[]);
    console.log('PASS: per-stay locations, detail link, 3 languages × 4 widths, late SDK selection, exact/area markers, unpublished locations, auth failure, 12 choices and invalid coordinates');
    // Adapter smoke check against the real Naver SDK, with explicit browser-only test inputs.
    await page.unroute('**/openapi/v3/maps.js*');
    await page.goto(base+'/?lang=en',{waitUntil:'networkidle'});
    await page.locator('#map-stay').selectOption('mia202');
    await page.waitForSelector('#naver-map .naver-area-label',{timeout:18000});
    assert.ok((await page.locator('.naver-area-label').textContent()).includes('Mia 202'));
    await page.locator('#map-stay').selectOption('mia201');
    assert.ok((await page.locator('.naver-area-label').textContent()).includes('Mia 201'));
    await page.locator('#map-stay').selectOption('busan');
    assert.equal(await page.locator('#naver-map').isVisible(),false);
    await page.locator('#map-stay').selectOption('mia202');
    assert.equal(await page.locator('#naver-map').isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: real Naver SDK renders, switches locations and restores after an unpublished stay');
  } finally { await browser.close(); }
}
(async()=>{
  if(process.argv.includes('--browser')) await checkBrowser();
  if(process.argv.includes('--maps')) await checkMaps();
})().catch(error=>{console.error(error);process.exitCode=1;});
