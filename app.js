'use strict';

// These same templates produce real HTML files and handle language changes.
// Browsing and Airbnb links work even without JavaScript; no detail modals.
const Serenity = (() => {
  const data = typeof module !== 'undefined' ? require('./content.js') : SERENITY_CONTENT;
  const languages = ['en', 'ko', 'zh'];
  const htmlLanguages = ['en', 'ko', 'zh-Hans'];
  const openStays = data.stays.filter(stay => stay.status === 'open');
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icons = {
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    diagonal: '<path d="M6 18 18 6M6 6h12v12"/>',
    down: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
    left: '<path d="m14 6-6 6 6 6"/>',
    right: '<path d="m10 6 6 6-6 6"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="m9 5 11 7-11 7Z"/>',
    home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
    people: '<circle cx="10" cy="7" r="3"/><path d="M3 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6M21 21v-4a5 5 0 0 0-3-4"/>',
    bed: '<path d="M3 18v3m18-3v3M3 18V8h18v10ZM5 8V3h14v5M3 13h18M8 8v5m8-5v5"/>',
    bath: '<path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5ZM5 12V5a3 3 0 0 1 6 0M7 20v2m10-2v2"/>',
    kitchen: '<path d="M5 3v8m4-8v8M3 7h8M7 11v10M19 3c-4 2-4 8 0 8V3Zm0 8v10"/>',
    laundry: '<rect x="3" y="2" width="18" height="20" rx="2"/><path d="M3 7h18M7 4h1m3 0h1"/><circle cx="12" cy="14" r="4"/>',
    key: '<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-6-6 3-3m0 6 3-3"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    elevator: '<rect x="3" y="2" width="18" height="20" rx="1"/><path d="M12 2v20m-6-9 2-3 2 3m4-2 2 3 2-3"/>',
    parking: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 18V6h4a4 4 0 0 1 0 8H9"/>',
    ocean: '<path d="M2 9c3-4 5 4 10 0s7 4 10 0M2 15c3-4 5 4 10 0s7 4 10 0M2 21c3-4 5 4 10 0s7 4 10 0"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.home}</svg>`;

  function mapUrls(stay) {
    const {lat,lng,span} = stay.map;
    const bounds = [lng-span,lat-span*.65,lng+span,lat+span*.65].map(value=>value.toFixed(5));
    return {
      embed: 'https://www.openstreetmap.org/export/embed.html?bbox='+encodeURIComponent(bounds.join(','))+'&layer=mapnik',
      external: 'https://www.openstreetmap.org/#map=14/'+lat+'/'+lng
    };
  }

  function createView(language = 'en', root = '') {
    const index = Math.max(0, languages.indexOf(language));
    const local = tuple => tuple[index];
    const t = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), local(data.copy[key]));
    const tx = key => escape(t(key));
    const city = name => local(data.destinations.find(item => item.id === name).name);
    const asset = src => escape(root + src);
    const url = stay => `${root}stays/${stay.id}.html`;
    const booking = stay => `https://www.airbnb.co.kr/rooms/${stay.listingId}`;
    const external = `target="_blank" rel="noopener noreferrer"`;
    const image = (src, alt, cls = '', eager = false) => `<img class="${cls}" src="${asset(src)}" alt="${escape(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
    const bookLink = (stay, cls = 'button button-gold') => `<a class="${cls}" href="${booking(stay)}" ${external}>${tx('bookAirbnb')}${icon('diagonal')}<span class="sr-only">${tx('external')}</span></a>`;

    function header() {
      return `<header class="site-header shell">
        <a class="brand" href="${root}index.html" aria-label="${tx('home')}">${image('assets/logo-wood.png', '', 'brand-mark', true)}<span>SERENITY <span class="brand-stay">STAY</span></span></a>
        <nav class="main-nav" id="main-nav" aria-label="${tx('menu')}">
          <a href="${root}index.html#stays">${tx('navStays')}</a><a href="${root}index.html#why">${tx('navWhy')}</a><a href="${root}index.html#places">${tx('navPlaces')}</a>
        </nav>
        <div class="header-actions"><label class="language-select"><span aria-hidden="true">◎</span><span class="sr-only">${tx('language')}</span><select id="language">${languages.map((lang, i) => `<option value="${lang}" ${index === i ? 'selected' : ''}>${['EN', '한국어', '中文'][i]}</option>`).join('')}</select></label><a class="header-book" href="${root}index.html#stays">${tx('findStay')}${icon('diagonal')}</a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav"><span>${tx('menu')}</span><span class="menu-lines" aria-hidden="true"></span></button></div>
      </header>`;
    }

    function homeHero() {
      return `<section class="hero home-hero" id="top" aria-label="${tx('heroSlides')}">
        <div class="hero-visual">${openStays.map((stay, i) => `<div class="hero-slide ${i === 0 ? 'is-active' : ''}" data-slide="${i}" ${i > 0 ? 'aria-hidden="true"' : ''}>${image(stay.cover, local(stay.alt), '', i === 0)}</div>`).join('')}</div>
        <div class="hero-shade"></div>
        <div class="hero-content">${header()}
          <div class="hero-copy shell"><p class="eyebrow hero-intro">${tx('heroKicker')}</p><h1><span class="line-mask"><span>${tx('heroLine1')}</span></span><span class="line-mask"><em>${tx('heroLine2')}</em></span></h1><p class="hero-description">${tx('heroDescription')}</p><a class="button button-cream" href="#stays">${tx('heroExplore')}${icon('arrow')}</a></div>
          <div class="hero-bottom shell"><a class="scroll-hint" href="#stays">${icon('down')}<span>${tx('scroll')}</span></a><div class="slide-info"><a id="hero-caption" href="${url(openStays[0])}">${escape(local(openStays[0].name))} · ${escape(city(openStays[0].city))}</a><div class="slide-controls"><span id="hero-count">01 / ${String(openStays.length).padStart(2,'0')}</span><button type="button" id="hero-prev" aria-label="${tx('previous')}">${icon('left')}</button><button type="button" id="hero-next" aria-label="${tx('next')}">${icon('right')}</button><button type="button" id="hero-pause" aria-label="${tx('pause')}">${icon('pause')}</button></div></div></div>
        </div>
      </section>`;
    }

    function card(stay) {
      if (stay.status === 'coming-soon') return `<article class="stay-card upcoming" id="${stay.id}">
        <div class="coming-art"><div class="coming-city">${image('assets/busan-gwangan.jpg', '', '')}</div><div class="coming-art-content"><span class="status-badge">${tx('comingSoon')}</span>${image('assets/logo-wood.png', '', 'coming-mark')}<h3>${tx('comingLine1')} <em>${tx('comingLine2')}</em></h3><span class="coming-caption">SERENITY STAY · BUSAN</span></div></div>
        <div class="card-body"><p class="card-area">${escape(city(stay.city))} · ${tx('comingSoon')}</p><h3>${tx('comingName')}</h3><p class="coming-note">${tx('comingNote')}</p></div></article>`;
      return `<article class="stay-card" id="${stay.id}"><a class="stay-card-link" href="${url(stay)}">
        <div class="card-photo">${image(stay.cover, local(stay.alt))}<span class="city-badge">${escape(city(stay.city))}</span><span class="photo-arrow">${icon('diagonal')}</span></div>
        <div class="card-body"><p class="card-area">${escape(local(stay.area))}</p><div class="card-title"><h3>${escape(local(stay.name))}</h3>${icon('arrow')}</div><p class="card-tagline">${escape(local(stay.signature.title))}</p><span class="sr-only">${tx('fullTour')}</span></div>
        </a></article>`;
    }

    function showcase(stay) {
      return `<article class="home-showcase" aria-labelledby="showcase-name">
        <div class="showcase-photos"><a class="showcase-cover" href="${url(stay)}">${image(stay.cover,local(stay.alt))}<span class="showcase-photo-label">SERENITY STAY / ${escape(stay.city.toUpperCase())}</span></a></div>
        <div class="showcase-copy"><p class="eyebrow">${escape(city(stay.city))} · ${escape(local(stay.area))}</p><h3 id="showcase-name">${escape(local(stay.name))}</h3><p class="showcase-signature">${escape(local(stay.signature.title))}</p><p class="showcase-story">${escape(local(stay.signature.text))}</p><ul class="showcase-facts"><li>${icon('people')}${escape(t('guestCount',{n:stay.maxGuests}))}</li><li>${icon('bed')}${escape(t('bedroomCount',{n:stay.bedrooms}))}</li><li>${icon('bath')}${escape(t('bathroomCount',{n:stay.bathrooms}))}</li></ul><ul class="showcase-amenities">${stay.amenities.slice(0,3).map(key=>`<li>${tx(key)}</li>`).join('')}</ul><a class="button button-dark" href="${url(stay)}">${tx('viewTour')}${icon('arrow')}</a><a class="showcase-location" href="${url(stay)}#location">${icon('pin')}${tx('viewLocation')}</a></div>
      </article>`;
    }

    function mapPanel(stay) {
      const urls=mapUrls(stay);
      return `<div class="map-panel"><div class="map-label"><span>${tx('mapSample')}</span><strong>${escape(local(stay.map.label))}</strong></div><iframe class="neighbourhood-map" src="${escape(urls.embed)}" title="${escape(t('mapTitleLabel',{name:local(stay.name)}))}" loading="lazy" referrerpolicy="no-referrer"></iframe><div class="map-caption"><p>${tx('mapNotice')}</p><a href="${escape(urls.external)}" ${external}>${tx('mapOpen')}${icon('diagonal')}<span class="sr-only">${tx('external')}</span></a></div><p class="map-network-note">${tx('mapUnavailable')}</p></div>`;
    }

    function collectionMap(stay) {
      return `<div class="collection-map" id="collection-map"><div class="collection-map-copy"><p class="eyebrow">${tx('mapKicker')}</p><h3>${tx('mapTitle')}</h3><p>${tx('mapDescription')}</p><label class="map-select-label" for="map-stay">${tx('mapSelect')}</label><select id="map-stay">${openStays.map(item=>`<option value="${item.id}" ${item.id===stay.id?'selected':''}>${escape(local(item.name))} · ${escape(city(item.city))}</option>`).join('')}</select><p class="map-selected-home"><span>${tx('mapFor')}</span><strong id="map-home-name">${escape(local(stay.name))}</strong></p></div><div id="collection-map-panel">${mapPanel(stay)}</div></div>`;
    }

    function benefit(name, pictogram) {
      return `<li class="benefit reveal">${icon(pictogram)}<h3>${tx(`value${name}`)}</h3><p>${tx(`value${name}Text`)}</p></li>`;
    }

    function destination(place) {
      const first = openStays.find(stay => stay.city === place.id);
      return `<article class="destination reveal" id="city-${place.id.toLowerCase()}"><a class="destination-photo" href="${escape(place.guideUrl)}" ${external} aria-label="${escape(t('exploreCity',{city:local(place.name)}))} — ${tx('external')}">${image(place.image, local(place.alt))}<span class="destination-shade"></span><div class="destination-overlay"><span class="eyebrow">${escape(local(place.headline))}</span><h3>${escape(local(place.name))}${index===1?'':`<span lang="ko">${place.korean}</span>`}</h3><p>${escape(local(place.description))}</p></div><span class="destination-hover-cta" aria-hidden="true">${escape(t('exploreCity',{city:local(place.name)}))}${icon('diagonal')}</span></a><div class="destination-body"><p class="destination-city-label">${escape(local(place.name))} / ${tx('cityGuide')}</p><a class="sight-link" href="${escape(place.sightUrl)}" ${external}><span><strong>${escape(local(place.sight))}</strong><span>${escape(local(place.sightNote))}</span></span>${icon('diagonal')}<span class="sr-only">${tx('external')}</span></a><div class="destination-links"><a href="${escape(place.guideUrl)}" ${external}>${tx('cityGuide')} ${icon('diagonal')}<span class="sr-only">${tx('external')}</span></a><a href="${root}index.html#${first.id}">${escape(t('seeStays',{city:local(place.name)}))}${icon('arrow')}</a></div></div></article>`;
    }

    function home(featured = openStays[0]) {
      return `${homeHero()}
        <section class="section collection shell" id="stays" aria-labelledby="collection-title"><div class="collection-intro reveal"><div><p class="eyebrow">${tx('collectionKicker')}</p><h2 id="collection-title">${tx('collectionTitle')}</h2></div><div class="host-introduction"><p>${tx('collectionDescription')}</p><p class="host-signature">${image('assets/logo-wood.png','','host-mark')}<span>${tx('hostSignature')}</span></p></div></div>
        <div class="showcase-toolbar"><p class="eyebrow">${tx('featuredKicker')}</p><div class="showcase-navigation js-control"><span id="showcase-count">${String(openStays.findIndex(item=>item.id===featured.id)+1).padStart(2,'0')} / ${String(openStays.length).padStart(2,'0')}</span><button class="round-button" data-showcase-step="-1" aria-controls="featured-home" aria-label="${tx('showcasePrev')}" type="button">${icon('left')}</button><button class="round-button" data-showcase-step="1" aria-controls="featured-home" aria-label="${tx('showcaseNext')}" type="button">${icon('right')}</button></div></div><div id="featured-home">${showcase(featured)}</div><p id="showcase-status" class="sr-only" role="status"></p>
        <div class="collection-meta"><div><h3>${tx('browseHomes')}</h3><span>${escape(t('collectionCount',{open:openStays.length,soon:data.stays.length-openStays.length}))}</span></div><div class="rail-controls js-control"><button class="round-button" data-scroll-for="home-rail" data-scroll-step="-1" aria-label="${tx('railPrev')}" type="button">${icon('left')}</button><button class="round-button" data-scroll-for="home-rail" data-scroll-step="1" aria-label="${tx('railNext')}" type="button">${icon('right')}</button></div></div><div class="home-rail" id="home-rail" data-scroll-track tabindex="0" aria-label="${tx('browseHomes')}">${data.stays.map(card).join('')}</div>${collectionMap(featured)}</section>
        <section class="why-section" id="why" aria-labelledby="why-title"><div class="shell"><div class="section-heading centered reveal"><p class="eyebrow">${tx('whyKicker')}</p><h2 id="why-title">${tx('whyTitle')}</h2><p>${tx('whyDescription')}</p></div><ul class="benefits">${benefit('Together','people')}${benefit('Home','home')}${benefit('Kitchen','kitchen')}${benefit('Laundry','laundry')}${benefit('Arrival','key')}</ul><div class="quiet-note reveal"><span></span><p>${tx('heroFootnote')}</p><span></span></div></div></section>
        <section class="section places-section shell" id="places" aria-labelledby="places-title"><div class="section-heading split reveal"><div><p class="eyebrow">${tx('placesKicker')}</p><h2 id="places-title">${tx('placesTitle')}</h2></div><p>${tx('placesDescription')}</p></div><div class="destinations-grid">${data.destinations.map(destination).join('')}</div></section>`;
    }

    function detail(stay) {
      if (!stay || stay.status !== 'open') return `<div class="dark-header">${header()}</div><section class="empty-state shell" id="top"><p class="eyebrow">SERENITY STAY</p><h1>${tx('notFound')}</h1><p>${tx('notFoundText')}</p><a class="button button-dark" href="${root}index.html#stays">${tx('backStays')}${icon('arrow')}</a></section>`;
      const place = data.destinations.find(item => item.id === stay.city);
      const facts = [['guests',stay.maxGuests],['bedrooms',stay.bedrooms],['beds',stay.beds],['bathrooms',stay.bathrooms]];
      const amenityIcon = {tub:'bath',kitchen:'kitchen',laundry:'laundry',elevator:'elevator',parking:'parking',selfCheckIn:'key',ocean:'ocean'};
      return `<section class="hero detail-hero" id="top"><div class="hero-visual">${image(stay.cover, local(stay.alt), 'detail-cover', true)}</div><div class="hero-shade"></div><div class="hero-content">${header()}<div class="hero-copy shell"><a class="back-link" href="${root}index.html#stays">${icon('left')}${tx('backStays')}</a><p class="eyebrow">${escape(city(stay.city))} / ${escape(local(stay.area))}</p><h1><span class="line-mask"><span>${escape(local(stay.name))}</span></span></h1><p class="detail-tagline">${escape(local(stay.tagline))}</p><div class="hero-buttons">${bookLink(stay,'button button-cream')}<a class="button button-outline" href="#gallery">${tx('gallery')}${icon('down')}</a></div></div><div class="detail-hero-foot shell"><span>${tx('privateHome')}</span><span>SERENITY STAY · ${escape(stay.city.toUpperCase())}</span></div></div></section>
        <div class="stay-overview shell"><dl class="stats">${facts.map(([label,value])=>`<div><dt>${tx(label)}</dt><dd>${value}</dd></div>`).join('')}</dl><nav class="detail-nav" aria-label="${tx('about')}">${[['about','about'],['gallery','gallery'],['amenities','amenities'],['location','location']].map(([id,key])=>`<a href="#${id}">${tx(key)}</a>`).join('')}</nav></div>
        <section class="detail-story section shell" id="about"><div class="story-copy reveal"><p class="eyebrow">${tx('detailKicker')}</p><h2>${escape(local(stay.storyTitle))}</h2><p class="story-description">${escape(local(stay.description))}</p><p class="detail-host-note">${tx('detailHostNote')}</p><div class="sleeping-copy"><span class="small-icon">${icon('bed')}</span><div><h3>${tx('sleepingTitle')}</h3><p>${escape(local(stay.sleeping))}</p></div></div></div><figure class="story-photo reveal">${image(stay.storyImage,t('photoOf',{name:local(stay.name),n:stay.photos.indexOf(stay.storyImage)+1}))}<figcaption><span>${escape(local(stay.name))}</span><span>Serenity Stay</span></figcaption></figure></section>
        <section class="gallery-section" id="gallery" aria-labelledby="gallery-title"><div class="shell gallery-heading"><div class="section-heading reveal"><p class="eyebrow">${tx('gallery')}</p><h2 id="gallery-title">${tx('galleryTitle')}</h2><p>${tx('galleryHint')}</p></div><div class="gallery-controls"><button class="round-button" data-scroll-for="gallery-track" data-scroll-step="-1" aria-label="${tx('previous')}" type="button">${icon('left')}</button><button class="round-button" data-scroll-for="gallery-track" data-scroll-step="1" aria-label="${tx('next')}" type="button">${icon('right')}</button></div></div><div class="gallery-track" id="gallery-track" data-scroll-track tabindex="0" aria-label="${tx('gallery')}">${stay.photos.map((src,i)=>`<figure>${image(src,t('photoOf',{name:local(stay.name),n:i+1}))}<figcaption><span>${String(i+1).padStart(2,'0')} / ${String(stay.photos.length).padStart(2,'0')}</span><span>${escape(local(stay.name))}</span></figcaption></figure>`).join('')}</div></section>
        <section class="section amenities-section shell" id="amenities"><div class="section-heading reveal"><p class="eyebrow">${tx('amenities')}</p><h2>${tx('amenityTitle')}</h2><p>${tx('sleepingNote')}</p></div><ul class="amenity-grid">${stay.amenities.map(key=>`<li class="reveal">${icon(amenityIcon[key])}<span>${tx(key)}</span></li>`).join('')}</ul></section>
        <section class="location-section" id="location"><div class="shell location-grid"><div class="location-map">${mapPanel(stay)}</div><div class="location-copy reveal"><p class="eyebrow">${escape(city(stay.city))} / ${escape(local(stay.area))}</p><h2>${tx('localTitle')}</h2><p>${escape(local(stay.neighbourhood))}</p><p class="address-note">${icon('pin')}${tx('exactAddress')}</p><a class="text-link" href="${escape(place.guideUrl)}" ${external}>${tx('cityGuide')}${icon('diagonal')}<span class="sr-only">${tx('external')}</span></a><details class="arrival-details"><summary>${tx('arrival')}<span aria-hidden="true">+</span></summary><p>${tx(stay.arrivalKey)}</p></details></div></div></section>
        <section class="reserve-section shell reveal" id="reserve"><p class="eyebrow">${tx('reserveKicker')}</p><h2>${tx('reserveTitle')}</h2><p class="reserve-name">${escape(local(stay.name))} · ${escape(city(stay.city))}</p>${bookLink(stay)}<p class="reserve-note">${tx('reserveNote')}</p><a class="text-link" href="${root}index.html#stays">${tx('allStays')}${icon('arrow')}</a></section>`;
    }

    function footer() {
      return `<footer class="site-footer"><div class="shell footer-top"><div><a class="brand" href="${root}index.html" aria-label="${tx('home')}">${image('assets/logo-wood.png','','brand-mark')}<span>SERENITY STAY</span></a><p class="footer-line">${tx('footerLine')}</p></div><div class="footer-booking"><p class="eyebrow">SEOUL · BUSAN · MORE TO COME</p><h2>${tx('bookingNote')}</h2><p>${tx('bookingExplain')}</p><a class="text-link" href="${root}index.html#stays">${tx('findStay')}${icon('arrow')}</a></div></div><div class="shell footer-bottom"><span>© 2026 SERENITY STAY</span><details class="photo-credits"><summary>${tx('credit')}</summary><p>${tx('archival')}</p>${data.destinations.map(place=>`<p>${escape(local(place.sight))} — <a href="${escape(place.creditUrl)}" ${external}>${place.creditName}, ${place.year} · Wikimedia Commons</a> · <a href="https://creativecommons.org/licenses/by/2.0/" ${external}>CC BY 2.0</a></p>`).join('')}</details><a href="#top">${tx('backTop')}${icon('down')}</a></div></footer>`;
    }
    return {t,local,city,header,card,showcase,mapPanel,home,detail,footer,url,booking,htmlLang:htmlLanguages[index]};
  }
  return {data,languages,openStays,createView,mapUrls,escape,icon};
})();

if (typeof module !== 'undefined') module.exports = Serenity;
else (() => {
  const {data,openStays,createView,icon} = Serenity;
  const root = document.body.dataset.root || '';
  const page = document.body.dataset.page;
  const selectedStay = data.stays.find(stay => stay.id === page);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let featuredStay = openStays[0];
  let mappedStay = openStays[0];
  let language = 'en';
  let view = createView(language,root);
  let cleanupMotion = () => {};
  let cleanupSlideshow = () => {};
  let cleanupTracks = () => {};

  function animateSections() {
    if (!('IntersectionObserver' in window) || reduceMotion.matches) return;
    const elements = [...document.querySelectorAll('.reveal')];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },{threshold:0.08});
    elements.forEach(element=>{element.classList.add('will-reveal');observer.observe(element);});
    cleanupMotion=()=>{observer.disconnect();elements.forEach(el=>el.classList.remove('will-reveal'));};
  }

  function startSlideshow() {
    const hero = document.querySelector('.home-hero');
    if (!hero || openStays.length < 2) return;
    const slides = [...hero.querySelectorAll('.hero-slide')];
    const pause = document.getElementById('hero-pause');
    let index = Math.max(0,slides.findIndex(slide=>slide.classList.contains('is-active')));
    let timer;
    let userPaused = reduceMotion.matches;
    let inView = true;
    function schedule() {
      clearTimeout(timer);
      const stopped = userPaused || reduceMotion.matches || document.hidden || !inView;
      hero.classList.toggle('is-paused',stopped);
      pause.hidden=reduceMotion.matches;
      pause.innerHTML=icon(userPaused ? 'play' : 'pause');
      pause.setAttribute('aria-label',view.t(userPaused?'play':'pause'));
      if (!stopped) timer=setTimeout(()=>show(index+1),7200);
    }
    function show(next) {
      index=(next+slides.length)%slides.length;
      slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===index);slide.setAttribute('aria-hidden',String(i!==index));});
      const stay=openStays[index];
      const caption=document.getElementById('hero-caption');
      caption.textContent=`${view.local(stay.name)} · ${view.city(stay.city)}`;
      caption.href=view.url(stay);
      document.getElementById('hero-count').textContent=`${String(index+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;
      schedule();
    }
    document.getElementById('hero-prev').onclick=()=>{userPaused=true;show(index-1);};
    document.getElementById('hero-next').onclick=()=>{userPaused=true;show(index+1);};
    pause.onclick=()=>{userPaused=!userPaused;schedule();};
    document.addEventListener('visibilitychange',schedule);
    const observer='IntersectionObserver' in window ? new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;schedule();}) : null;
    observer?.observe(hero);
    schedule();
    cleanupSlideshow=()=>{clearTimeout(timer);observer?.disconnect();document.removeEventListener('visibilitychange',schedule);};
  }

  // Both photo tours and the home rail share one native scroll-snap controller.
  function setupScrollTracks() {
    const cleanups=[];
    document.querySelectorAll('[data-scroll-track]').forEach(track=>{
      const buttons=[...document.querySelectorAll(`[data-scroll-for="${track.id}"]`)];
      const update=()=>{buttons[0].disabled=track.scrollLeft<4;buttons[1].disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-4;};
      function step(direction) {
        const frames=[...track.children];
        const trackLeft=track.getBoundingClientRect().left;
        const inset=parseFloat(getComputedStyle(track).paddingLeft);
        const distances=frames.map(frame=>Math.abs(frame.getBoundingClientRect().left-trackLeft-inset));
        const current=distances.indexOf(Math.min(...distances));
        const target=frames[Math.max(0,Math.min(frames.length-1,current+direction))];
        const left=target.getBoundingClientRect().left-trackLeft+track.scrollLeft-inset;
        track.scrollTo({left,behavior:reduceMotion.matches?'auto':'smooth'});
      }
      buttons.forEach(button=>{button.onclick=()=>step(Number(button.dataset.scrollStep));});
      const onKey=event=>{if(event.target===track && (event.key==='ArrowRight'||event.key==='ArrowLeft')){event.preventDefault();step(event.key==='ArrowRight'?1:-1);}};
      track.addEventListener('keydown',onKey);
      track.addEventListener('scroll',update,{passive:true});
      window.addEventListener('resize',update);
      track.querySelectorAll('img').forEach(img=>img.addEventListener('load',update,{once:true}));
      update();
      cleanups.push(()=>{track.removeEventListener('keydown',onKey);track.removeEventListener('scroll',update);window.removeEventListener('resize',update);});
    });
    cleanupTracks=()=>cleanups.forEach(cleanup=>cleanup());
  }

  function showMap(stay) {
    mappedStay=stay;
    const panel=document.getElementById('collection-map-panel');
    if(!panel)return;
    panel.innerHTML=view.mapPanel(stay);
    document.getElementById('map-stay').value=stay.id;
    document.getElementById('map-home-name').textContent=view.local(stay.name);
  }

  function stepShowcase(direction) {
    const index=(openStays.findIndex(stay=>stay.id===featuredStay.id)+direction+openStays.length)%openStays.length;
    featuredStay=openStays[index];
    const panel=document.getElementById('featured-home');
    panel.innerHTML=view.showcase(featuredStay);
    document.getElementById('showcase-count').textContent=`${String(index+1).padStart(2,'0')} / ${String(openStays.length).padStart(2,'0')}`;
    document.getElementById('showcase-status').textContent=view.local(featuredStay.name);
    showMap(featuredStay);
    if(!reduceMotion.matches && panel.animate)panel.animate([{opacity:.25,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:550,easing:'ease-out'});
  }

  function enhance() {animateSections();startSlideshow();setupScrollTracks();}
  function applyLanguage(next) {
    if(!Serenity.languages.includes(next))return;
    cleanupMotion();cleanupSlideshow();cleanupTracks();
    language=next;view=createView(language,root);
    document.documentElement.lang=view.htmlLang;
    document.title=selectedStay ? `${view.local(selectedStay.name)} — Serenity Stay` : view.t('title');
    document.querySelector('meta[name="description"]').content=selectedStay?view.local(selectedStay.description):view.t('meta');
    document.getElementById('main').innerHTML=page==='home'?view.home(featuredStay):view.detail(selectedStay);
    document.getElementById('footer').innerHTML=view.footer();
    document.querySelector('.skip-link').textContent=view.t('skip');
    if(page==='home' && mappedStay.id!==featuredStay.id)showMap(mappedStay);
    try{localStorage.setItem('serenity-language',language);}catch{/* The preference is optional. */}
    enhance();
    document.getElementById('language')?.focus({preventScroll:true});
  }
  document.addEventListener('change',event=>{
    if(event.target.id==='language')applyLanguage(event.target.value);
    if(event.target.id==='map-stay'){
      const stay=openStays.find(item=>item.id===event.target.value);
      if(stay)showMap(stay);
    }
  });
  function closeMenu(){document.querySelector('.menu-toggle')?.setAttribute('aria-expanded','false');document.querySelector('.site-header')?.classList.remove('menu-open');}
  document.addEventListener('click',event=>{
    const showcaseControl=event.target.closest('[data-showcase-step]');
    if(showcaseControl)stepShowcase(Number(showcaseControl.dataset.showcaseStep));
    const toggle=event.target.closest('.menu-toggle');
    if(toggle){const expanded=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(expanded));toggle.closest('.site-header').classList.toggle('menu-open',expanded);}
    if(event.target.closest('.main-nav a'))closeMenu();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  reduceMotion.addEventListener('change',()=>{cleanupMotion();cleanupSlideshow();cleanupTracks();enhance();});
  document.documentElement.classList.add('js');
  let saved;
  try{saved=localStorage.getItem('serenity-language');}catch{/* File/private browsing is supported. */}
  if(saved && saved!=='en' && Serenity.languages.includes(saved))applyLanguage(saved);
  else enhance();
})();
