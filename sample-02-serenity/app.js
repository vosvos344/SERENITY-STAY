(() => {
  'use strict';
  const site = window.SERENITY;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = $('#stay-dialog');
  let language = 'en';
  let filter = 'all';
  let activeStay = null;
  let photoIndex = 0;
  let mapState = 'idle';
  let selectedMapStayId = site.stays[0].id;
  let naverMap = null;
  let mapMarker = null;
  let mapArea = null;
  const t = (key) => site.copy[language][key] ?? site.copy.en[key] ?? key;
  // Only the visitor's language preference is persisted. No visitor data is collected.
  try { language = localStorage.getItem('serenity-language') || 'en'; } catch { /* Storage is optional. */ }
  const requestedLanguage = new URLSearchParams(location.search).get('lang');
  if (requestedLanguage) language = requestedLanguage;
  if (!site.copy[language]) language = 'en';

  const rail = $('#stay-grid');
  let motionTargets = [];
  let framePending = false;
  const clamp = (value) => Math.max(0, Math.min(1, value));
  function refreshMotionTargets() {
    motionTargets = $$('[data-scroll], .reveal');
    queueFrame();
  }
  function updateMotion() {
    const height = window.innerHeight;
    // Read all geometry before writing styles. Wrappers do not transform.
    const samples = motionTargets.map((element) => ({ element, rect: element.getBoundingClientRect() }));
    for (const { element, rect } of samples) {
      const effect = element.dataset.scroll || 'reveal';
      let progress;
      if (reducedMotion.matches) progress = effect === 'hero' || effect === 'ribbon' ? 0 : 1;
      else if (effect === 'hero') progress = clamp(-rect.top / (rect.height * .8));
      else if (effect === 'reveal') progress = clamp((height * .94 - rect.top) / Math.min(height * .3, 230));
      else if (effect === 'portal') progress = clamp((height * .86 - rect.top) / (height * .85));
      else if (effect === 'reading') progress = clamp((height * .9 - rect.top) / (height * .62));
      else progress = clamp((height - rect.top) / (height + rect.height * .4));
      element.style.setProperty(`--${effect}`, progress.toFixed(4));
    }
  }
  function updateRail() {
    const cards = [...rail.querySelectorAll('.stay-card:not([hidden])')];
    const origin = rail.getBoundingClientRect().left + parseFloat(getComputedStyle(rail).paddingLeft);
    let current = 0;
    let distance = Infinity;
    const cardRects = cards.map((card) => card.getBoundingClientRect());
    cardRects.forEach((rect, index) => {
      const delta = Math.abs(rect.left - origin);
      if (delta < distance) { distance = delta; current = index; }
    });
    cards.forEach((card, index) => card.style.setProperty('--focus', reducedMotion.matches ? 1 : clamp(1 - Math.abs(cardRects[index].left - origin) / cardRects[index].width).toFixed(4)));
    $('#rail-current').textContent = cards.length ? String(current + 1).padStart(2, '0') : '00';
    $('#rail-total').textContent = String(cards.length).padStart(2, '0');
    $('#rail-progress-fill').style.transform = `scaleX(${cards.length ? (current + 1) / cards.length : 0})`;
    $('#stay-prev').disabled = current === 0;
    $('#stay-next').disabled = current >= cards.length - 1;
    return { cards, current, origin };
  }
  function queueFrame() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => { framePending = false; updateMotion(); updateRail(); });
  }
  function moveStay(step) {
    const { cards, current, origin } = updateRail();
    const target = cards[current + step];
    if (!target) return;
    rail.scrollTo({ left: rail.scrollLeft + target.getBoundingClientRect().left - origin, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }
  $('#stay-prev').addEventListener('click', () => moveStay(-1));
  $('#stay-next').addEventListener('click', () => moveStay(1));
  rail.addEventListener('scroll', queueFrame, { passive: true });
  rail.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); moveStay(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  window.addEventListener('scroll', queueFrame, { passive: true });
  window.addEventListener('resize', queueFrame, { passive: true });
  document.fonts.ready.then(queueFrame);
  document.documentElement.classList.add('motion-ready');

  function renderStays() {
    rail.innerHTML = site.stays.map((stay, index) => {
      const open = stay.status === 'open';
      const image = `<img src="${escape(stay.cover)}" alt="${escape(t(stay.coverAlt))}" loading="lazy" width="1440" height="960"><span class="stay-image-ui"><span class="stay-tag">${escape(t(stay.tag))}</span>${open ? '<span class="photo-arrow" aria-hidden="true">↗</span>' : `<span class="soon-cover-title"><strong>COMING<br>SOON</strong><small>${escape(t('notOpenYet'))}</small></span><span class="destination-caption">${escape(t('destinationPhoto'))}</span>`}</span>`;
      const specs = open ? `<span>${escape(t('upTo'))} ${stay.guests} ${escape(t('guests'))}</span><span>${stay.bedrooms} ${escape(t('bedrooms'))}</span><span>${stay.baths} ${escape(t('baths'))}</span>` : `<span>${escape(t('comingSoon'))}</span>`;
      return `<article class="stay-card ${open ? '' : 'soon'}" data-city="${escape(stay.city)}" ${filter !== 'all' && filter !== stay.city ? 'hidden' : ''}>
        ${open ? `<button class="stay-photo" data-open-stay="${escape(stay.id)}" aria-label="${escape(t('exploreStay') + ' ' + stay.name)}">${image}</button>` : `<div class="stay-photo">${image}</div>`}
        <div class="stay-info"><div class="stay-meta"><span>${escape(t(stay.city))} · SOUTH KOREA</span><span class="stay-number">${String(index + 1).padStart(2, '0')}</span></div>
        ${open ? '' : `<span class="soon-status">${escape(t('comingSoon'))}</span>`}<div class="stay-title"><h3>${escape(stay.city === 'busan' ? t('busan') : stay.name)}</h3></div>
        <div class="stay-specs">${specs}</div><p class="stay-description">${escape(t(stay.intro))}</p>
        <div class="stay-bottom">${open ? `<button data-open-stay="${escape(stay.id)}">${escape(t('exploreStay'))}<span aria-hidden="true">↗</span></button><a href="${escape(stay.airbnb)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(stay.name + ' · ' + t('bookAirbnb'))}">${escape(t('onAirbnb'))} ↗</a>` : `<span class="coming-label">${escape(t('openingLater'))}</span>`}</div></div>
      </article>`;
    }).join('');
    refreshMotionTargets();
  }
  function applyFilter(value) {
    filter = value;
    $$('.filters button').forEach((button) => {
      const selected = button.dataset.filter === value;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $$('.stay-card').forEach((card) => { card.hidden = value !== 'all' && card.dataset.city !== value; });
    rail.scrollTo({ left: 0, behavior: 'instant' });
    $('#filter-status').textContent = `${$$('.stay-card:not([hidden])').length} ${t('showing')}`;
    queueFrame();
  }
  $$('.filters button').forEach((button) => button.addEventListener('click', () => applyFilter(button.dataset.filter)));
  $('#view-busan').addEventListener('click', () => {
    applyFilter('busan');
    rail.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    rail.focus({ preventScroll: true });
  });

  function renderGallery() {
    if (!activeStay) return;
    const [src, caption] = activeStay.photos[photoIndex];
    $('#dialog-photo').src = src;
    $('#dialog-photo').alt = t(caption);
    $('#gallery-caption').textContent = `${String(photoIndex + 1).padStart(2, '0')} / ${String(activeStay.photos.length).padStart(2, '0')} — ${t(caption)}`;
    $$('#gallery-thumbs button').forEach((button, index) => button.setAttribute('aria-pressed', String(index === photoIndex)));
    const thumb = $$('#gallery-thumbs button')[photoIndex];
    if (thumb && dialog.open) {
      const strip = $('#gallery-thumbs');
      strip.scrollTo({ left: strip.scrollLeft + thumb.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - thumb.clientWidth) / 2, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
    if (!reducedMotion.matches) $('#dialog-photo').animate([{ opacity: .3, transform: 'scale(1.025)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
  const featureMarkup = (items) => items.map(([title, copy]) => `<article><h4>${escape(t(title))}</h4><p>${escape(t(copy))}</p></article>`).join('');
  function populateDialog() {
    const stay = activeStay;
    if (!stay) return;
    $('#dialog-title').textContent = stay.name;
    $('#dialog-location').textContent = t(stay.city).toUpperCase();
    $('#dialog-eyebrow').textContent = t(stay.tag);
    $('#dialog-headline').textContent = t(stay.headline);
    $('#dialog-description').textContent = t(stay.description);
    $('#dialog-facts').innerHTML = [['guests', stay.guests], ['bedrooms', stay.bedrooms], ['baths', stay.baths]].map(([key, value]) => `<div><strong>${value}</strong><span>${escape(t(key))}</span></div>`).join('');
    $('#dialog-amenities').innerHTML = stay.amenities.map((key) => `<li>${escape(t(key))}</li>`).join('');
    $('#dialog-highlights').innerHTML = featureMarkup(stay.highlights);
    $('#dialog-equipment').innerHTML = featureMarkup(stay.equipment);
    $('#dialog-rooms').innerHTML = stay.rooms.map(([name, copy], index) => `<article class="room-row"><span>${String(index + 1).padStart(2, '0')}</span><div><h4>${escape(t(name))}</h4><p>${escape(t(copy))}</p></div></article>`).join('');
    $('#gallery-thumbs').innerHTML = stay.photos.map(([src, caption], index) => `<button data-gallery-photo="${index}" aria-label="${escape(`${index + 1}. ${t(caption)}`)}" aria-pressed="${index === photoIndex}"><img src="${escape(src)}" alt="" loading="lazy" width="90" height="70"></button>`).join('');
    $('#dialog-book').href = stay.airbnb;
    $('#dialog-area-description').textContent = t(stay.location?.description || 'areaDescription');
    $('#dialog-address').textContent = stay.location?.address || t(stay.city);
    $('#dialog-location-note').textContent = mapNoteFor(stay);
    renderGallery();
  }
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-stay]');
    if (!trigger) return;
    const stay = site.stays.find((item) => item.id === trigger.dataset.openStay && item.status === 'open');
    if (!stay) return;
    activeStay = stay;
    photoIndex = Math.min(Number(trigger.dataset.photo) || 0, stay.photos.length - 1);
    populateDialog();
    showDetailTab('overview');
    dialog.showModal();
    $('.dialog-layout').scrollTop = 0;
    renderGallery();
    refreshHeroPlayback();
  });
  function showDetailTab(name) {
    $$('.detail-tabs button').forEach((button) => {
      const selected = button.dataset.tab === name;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      $(`#panel-${button.dataset.tab}`).hidden = !selected;
    });
    $('.detail-content').scrollTop = 0;
  }
  $('.detail-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab]');
    if (button) showDetailTab(button.dataset.tab);
  });
  $('.detail-tabs').addEventListener('keydown', (event) => {
    const tabs = $$('.detail-tabs button');
    const current = tabs.indexOf(document.activeElement);
    if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    showDetailTab(tabs[index].dataset.tab); tabs[index].focus();
  });
  $('#gallery-thumbs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-gallery-photo]');
    if (button) { photoIndex = Number(button.dataset.galleryPhoto); renderGallery(); }
  });
  function nextPhoto(step) {
    if (!activeStay) return;
    photoIndex = (photoIndex + step + activeStay.photos.length) % activeStay.photos.length;
    renderGallery();
  }
  $('#gallery-prev').addEventListener('click', () => nextPhoto(-1));
  $('#gallery-next').addEventListener('click', () => nextPhoto(1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); nextPhoto(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { activeStay = null; refreshHeroPlayback(); });

  const menuButton = $('.menu-toggle');
  function closeMenu() {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', t('menu'));
    $('#mobile-nav').hidden = true;
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', t(open ? 'closeMenu' : 'menu'));
    $('#mobile-nav').hidden = !open;
  });
  $$('#mobile-nav a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#mobile-nav').hidden) { closeMenu(); menuButton.focus(); }
  });
  matchMedia('(min-width: 901px)').addEventListener('change', (event) => { if (event.matches) closeMenu(); });

  const hero = $('.hero');
  const media = $('#hero-media');
  const pauseButton = $('#hero-pause');
  let slideIndex = 0;
  let heroTimer;
  let slideProgress;
  let userPaused = reducedMotion.matches;
  let heroHovered = false;
  let heroFocused = false;
  let video = null;
  let videoFailed = false;
  const isVideo = site.hero.type === 'video' && Boolean(site.hero.src);
  $('#hero-place').textContent = isVideo ? site.brand : (site.hero.slides[0]?.label || site.brand);
  if (isVideo) {
    media.innerHTML = '';
    video = document.createElement('video');
    video.className = 'hero-video';
    video.muted = true; video.loop = true; video.playsInline = true;
    video.poster = site.hero.poster; video.preload = 'none';
    video.setAttribute('aria-label', 'Serenity Stay');
    media.append(video);
    $('#hero-prev').hidden = true; $('#hero-next').hidden = true; $('.slide-count').hidden = true;
    video.addEventListener('error', () => {
      videoFailed = true; userPaused = true;
      const poster = document.createElement('img');
      poster.src = site.hero.poster; poster.alt = 'Serenity Stay'; poster.className = 'hero-image is-active';
      media.replaceChildren(poster); pauseButton.hidden = true;
      refreshHeroPlayback();
    });
  } else {
    media.innerHTML = site.hero.slides.map((slide, index) => `<img class="hero-image ${index === 0 ? 'is-active' : ''}" src="${escape(slide.src)}" alt="${escape(t(slide.alt))}" aria-hidden="${index !== 0}" width="1440" height="960" ${index === 0 ? 'fetchpriority="high"' : ''}>`).join('');
    $('#hero-total').textContent = String(site.hero.slides.length).padStart(2, '0');
    if (site.hero.slides.length < 2) $('.hero-controls').hidden = true;
  }
  function updatePlaybackLabel() {
    pauseButton.textContent = userPaused ? '▷' : 'Ⅱ';
    pauseButton.setAttribute('aria-pressed', String(userPaused));
    pauseButton.setAttribute('aria-label', t(isVideo ? (userPaused ? 'playVideo' : 'pauseVideo') : (userPaused ? 'play' : 'pause')));
  }
  function refreshHeroPlayback() {
    clearTimeout(heroTimer);
    slideProgress?.cancel();
    const suspended = userPaused || document.hidden || dialog.open || (!isVideo && (heroHovered || heroFocused));
    hero.classList.toggle('is-paused', suspended);
    updatePlaybackLabel();
    if (isVideo) {
      if (videoFailed) return;
      if (suspended) video.pause();
      else {
        if (!video.getAttribute('src')) video.src = site.hero.src;
        video.play().catch(() => { userPaused = true; updatePlaybackLabel(); });
      }
    } else if (!suspended && site.hero.slides.length > 1) {
      slideProgress = $('#hero-progress').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: site.hero.interval, fill: 'forwards' });
      heroTimer = setTimeout(() => changeSlide(1), site.hero.interval);
    }
  }
  function changeSlide(step) {
    if (isVideo || !site.hero.slides.length) return;
    slideIndex = (slideIndex + step + site.hero.slides.length) % site.hero.slides.length;
    $$('.hero-image').forEach((img, index) => {
      img.classList.toggle('is-active', index === slideIndex);
      img.setAttribute('aria-hidden', String(index !== slideIndex));
    });
    $('#hero-current').textContent = String(slideIndex + 1).padStart(2, '0');
    $('#hero-place').textContent = site.hero.slides[slideIndex].label;
    refreshHeroPlayback();
  }
  $('#hero-prev').addEventListener('click', () => changeSlide(-1));
  $('#hero-next').addEventListener('click', () => changeSlide(1));
  pauseButton.addEventListener('click', () => { userPaused = !userPaused; refreshHeroPlayback(); });
  $('.hero-controls').addEventListener('mouseenter', () => { heroHovered = true; refreshHeroPlayback(); });
  $('.hero-controls').addEventListener('mouseleave', () => { heroHovered = false; refreshHeroPlayback(); });
  hero.addEventListener('focusin', () => { heroFocused = true; refreshHeroPlayback(); });
  hero.addEventListener('focusout', (event) => { if (!hero.contains(event.relatedTarget)) { heroFocused = false; refreshHeroPlayback(); } });
  document.addEventListener('visibilitychange', refreshHeroPlayback);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) userPaused = true;
    queueFrame();
    refreshHeroPlayback();
  });

  function hasLocation(stay) {
    const location = stay?.location;
    return location && ['exact', 'area'].includes(location.precision)
      && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
      && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
  }
  function mapNoteFor(stay) {
    if (hasLocation(stay)) return t(stay.location.precision === 'area' ? 'mapAreaNote' : 'mapExactNote');
    return t(stay.status === 'soon' ? 'mapSoon' : 'mapPendingNote');
  }
  function renderMapChoices() {
    if (!site.stays.some((stay) => stay.id === selectedMapStayId)) selectedMapStayId = site.stays[0].id;
    $('#map-stay').innerHTML = site.stays.map((stay) => `<option value="${escape(stay.id)}">${escape(stay.name)} · ${escape(t(stay.city))}${stay.status === 'soon' ? ` — ${escape(t('comingSoon'))}` : ''}</option>`).join('');
    $('#map-stay').value = selectedMapStayId;
    renderMap();
  }
  function renderMap() {
    const stay = site.stays.find((item) => item.id === selectedMapStayId);
    if (!stay) return;
    const located = hasLocation(stay);
    const location = stay.location;
    const name = stay.city === 'busan' && stay.id === 'busan' ? t('busan') : stay.name;
    const precision = located ? (location.precision === 'area' ? 'locationArea' : 'locationExact') : (stay.status === 'soon' ? 'locationSoon' : 'locationPending');
    $('#map-city').textContent = t(stay.city);
    $('#map-stay-name').textContent = name;
    $('#map-stay-photo').src = stay.cover;
    $('#map-stay-photo').alt = t(stay.coverAlt);
    $('#map-address').textContent = location?.address || (location?.area ? t(location.area) : t(precision));
    $('#map-precision').textContent = `${stay.status === 'soon' ? `${t('comingSoon')} · ` : ''}${t(precision)}`;
    $('#map-fallback-label').textContent = t(precision);
    $('#map-fallback-title').textContent = name;
    $('#map-note').textContent = mapNoteFor(stay);
    $('#naver-map').setAttribute('aria-label', `${name} · ${t('mapRegion')} · ${t(precision)}`);
    const url = location?.naverUrl || stay.airbnb;
    for (const link of [$('#map-fallback-link'), $('#map-external-link')]) {
      link.hidden = !url;
      if (url) link.href = url;
      else link.removeAttribute('href');
      link.firstElementChild.textContent = t(location?.naverUrl ? 'openMap' : 'mapAirbnb');
    }
    $('#naver-map').hidden = !located || mapState !== 'ready';
    $('#map-fallback').hidden = located && mapState === 'ready';
    $('#map-status').textContent = t(!located ? (stay.status === 'soon' ? 'mapSoon' : 'mapPending') : mapState === 'error' ? 'mapUnavailable' : 'mapLoading');
    if (!located || mapState !== 'ready') {
      mapMarker?.setMap(null);
      mapArea?.setMap(null);
      return;
    }
    try {
      const n = window.naver.maps;
      const center = new n.LatLng(location.latitude, location.longitude);
      const zoom = location.zoom ?? (location.precision === 'area' ? 14 : 16);
      if (!naverMap) {
        naverMap = new n.Map('naver-map', { center, zoom, minZoom: 6, scrollWheel: false, zoomControl: true, zoomControlOptions: { position: n.Position.TOP_RIGHT }, mapDataControl: true });
        mapMarker = new n.Marker({ position: center });
        mapArea = new n.Circle({ center, radius: 650, strokeColor: '#737e60', strokeWeight: 1, strokeOpacity: .65, fillColor: '#9ba889', fillOpacity: .2 });
      } else {
        // A hidden map may have been resized while a location was pending.
        const frame = $('#naver-map');
        naverMap.setSize(new n.Size(frame.clientWidth, frame.clientHeight));
      }
      naverMap.updateBy(center, zoom);
      mapMarker.setOptions({ position: center, title: `${name} · ${t(precision)}`, icon: { content: `<div class="naver-area-label">${escape(name)}<small>${escape(t(precision))}</small></div>`, anchor: new n.Point(95, 46) } });
      mapMarker.setMap(naverMap);
      mapArea.setCenter(center);
      mapArea.setMap(location.precision === 'area' ? naverMap : null);
    } catch (error) {
      console.warn('Naver map initialization failed:', error);
      mapFallback();
    }
  }
  function mapFallback() {
    mapState = 'error';
    renderMap();
  }
  function loadMap() {
    if (mapState !== 'idle' || !hasLocation(site.stays.find((stay) => stay.id === selectedMapStayId))) return;
    mapState = 'loading';
    renderMap();
    const timeout = setTimeout(mapFallback, 12000);
    window.navermap_authFailure = () => { clearTimeout(timeout); mapFallback(); };
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(site.map.clientId)}`;
    script.async = true;
    script.onload = () => {
      clearTimeout(timeout);
      if (mapState !== 'loading') return;
      if (!window.naver?.maps?.Map) { mapFallback(); return; }
      mapState = 'ready';
      // Resolve the current choice, including changes made during SDK loading.
      renderMap();
    };
    script.onerror = () => { clearTimeout(timeout); mapFallback(); };
    document.head.append(script);
  }
  $('#map-stay').addEventListener('change', (event) => {
    selectedMapStayId = event.target.value;
    renderMap();
    loadMap();
  });
  $('#dialog-show-map').addEventListener('click', () => {
    if (!activeStay) return;
    selectedMapStayId = activeStay.id;
    $('#map-stay').value = selectedMapStayId;
    dialog.close();
    renderMap();
    loadMap();
    $('#neighborhood').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    $('#map-stay').focus({ preventScroll: true });
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { loadMap(); observer.disconnect(); }
    }, { rootMargin: '300px' });
    observer.observe($('#neighborhood'));
  } else loadMap();

  function composeReadingWords() {
    const heading = $('.reading-title');
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const segmenter = new Intl.Segmenter(language, { granularity: 'word' });
    let index = 0;
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      for (const { segment } of segmenter.segment(node.textContent)) {
        if (!segment.trim()) { fragment.append(document.createTextNode(segment)); continue; }
        const word = document.createElement('span');
        word.className = 'reading-word'; word.textContent = segment;
        word.style.setProperty('--word', index++);
        fragment.append(word);
      }
      node.replaceWith(fragment);
    }
    heading.style.setProperty('--words', index + 1);
  }
  function setLanguage(value) {
    language = site.copy[value] ? value : 'en';
    document.documentElement.lang = { en: 'en', zh: 'zh-CN', ko: 'ko' }[language];
    $('#language').value = language;
    $$('[data-i18n]').forEach((element) => { element.innerHTML = t(element.dataset.i18n); });
    composeReadingWords();
    $$('[data-i18n-aria]').forEach((element) => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
    document.title = t('pageTitle');
    $('meta[name="description"]').content = t('pageDescription');
    $('meta[property="og:title"]').content = t('pageTitle');
    $('meta[property="og:description"]').content = t('pageDescription');
    $('#language').setAttribute('aria-label', t('language'));
    renderMapChoices();
    if (!isVideo) $$('.hero-image').forEach((img, i) => { img.alt = t(site.hero.slides[i].alt); });
    renderStays();
    applyFilter(filter);
    populateDialog();
    updatePlaybackLabel();
    menuButton.setAttribute('aria-label', t(menuButton.getAttribute('aria-expanded') === 'true' ? 'closeMenu' : 'menu'));
  }
  $('#language').addEventListener('change', (event) => {
    setLanguage(event.target.value);
    try { localStorage.setItem('serenity-language', language); } catch { /* Preference is optional. */ }
    if (location.protocol !== 'file:') {
      const url = new URL(location.href); url.searchParams.set('lang', language);
      history.replaceState(null, '', url);
    }
  });
  $('#year').textContent = new Date().getFullYear();
  setLanguage(language);
  refreshMotionTargets();
  refreshHeroPlayback();
})();
