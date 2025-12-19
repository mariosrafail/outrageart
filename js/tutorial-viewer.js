/* Tutorial Viewer (steps modal)
   Opens a modal and auto-detects numbered steps (1.png, 2.png, ...) in the same folder as a given URL.
   Depends on markup injected in index.html (#tutorialModal etc.) and variables from styles.css.
*/

(function(){
  const modal = document.getElementById('tutorialModal');
  if (!modal) return;

  const backdrop = modal.querySelector('[data-tut-close]');
  const closeBtn = document.getElementById('tutClose');
  const stage = document.getElementById('tutStage');
  const mainImg = document.getElementById('tutMain');
  const prevBtn = document.getElementById('tutPrev');
  const nextBtn = document.getElementById('tutNext');
  const counter = document.getElementById('tutCounter');
  const thumbsWrap = document.getElementById('tutThumbs');

  let base = null;         // folder url
  let ext = 'png';
  let steps = [];          // array of URLs: base + n + .png
  let idx = 0;             // 0-based
  let scanning = false;

  function deriveBase(fileUrl){
    if (!fileUrl) return null;
    // remove filename
    return fileUrl.replace(/[^/]+$/, '');
  }

  function setBodyLock(lock){
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

  function exists(url){
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(true);
      im.onerror = () => resolve(false);
      // cache buster keeps Nextcloud from returning cached 404/older images
      im.src = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
    });
  }

  function renderNav(){
    prevBtn.disabled = (idx <= 0);
    nextBtn.disabled = (idx >= steps.length - 1);
    counter.textContent = `${idx + 1} / ${steps.length || 0}`;

    // aria-current
    [...thumbsWrap.children].forEach((t, k) => t.setAttribute('aria-current', k === idx ? 'true' : 'false'));
  }

  function scrollToCurrent(){

    const t = thumbsWrap.children[idx];

    if (t) t.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
  }

  function preload(i){
    if (i < 0 || i >= steps.length) return;
    const im = new Image();
    im.src = steps[i];
  }

  function show(i, userInitiated){
    if (!steps.length) return;
    idx = clamp(i, 0, steps.length - 1);
    const v = window.TUT_CACHE_BUST || Date.now();
	mainImg.src = `${steps[idx]}?v=${v}`;
    mainImg.alt = `Βήμα ${idx + 1}`;
    renderNav();
    preload(idx + 1);
    preload(idx + 2);
    preload(idx - 1);
    if (userInitiated) scrollToCurrent();
  }

  function clearUI(){
    steps = [];
    idx = 0;

    thumbsWrap.innerHTML = '';
    mainImg.removeAttribute('src');
    mainImg.alt = '';
    counter.textContent = 'Loading…';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  }

  function addStep(n){
    const url = `${base}${n}.${ext}`;
    steps.push(url);


    // thumb
    const th = document.createElement('button');
    th.type = 'button';
    th.className = 'tut-thumb';
    th.setAttribute('aria-label', `Άνοιγμα βήματος ${n}`);
    th.addEventListener('click', () => show(n - 1, true));

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = `Μικρογραφία βήματος ${n}`;
    const v = window.TUT_CACHE_BUST || Date.now();
	img.src = `${url}?v=${v}`;


    const badge = document.createElement('span');
    badge.className = 'n';
    badge.textContent = n;

    th.appendChild(img);
    th.appendChild(badge);
    thumbsWrap.appendChild(th);
  }

  async function scanSteps(){
    if (!base || scanning) return;
    scanning = true;

    // start at 1 and stop at first missing
    const maxScan = 2500;
    for (let n = 1; n <= maxScan; n++){
      const url = `${base}${n}.${ext}`;
      const ok = await exists(url);
      if (!ok) break;
      addStep(n);

      // Once first step exists, show immediately
      if (n === 1){
        show(0, false);
      }

      // Keep UI responsive: after some steps, yield
      if (n % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }

    if (!steps.length){
      counter.textContent = '0 / 0';
      mainImg.alt = 'Δεν βρέθηκαν βήματα';
    } else {
      renderNav();
    }

    scanning = false;
  }

  function open(){
    modal.hidden = false;
    modal.classList.add('show');
    setBodyLock(true);
  }

  function close(){
    modal.classList.remove('show');
    modal.hidden = true;
    setBodyLock(false);
    clearUI();
  }

  // Public API called from app.js
  window.openTutorialModal = function(fileUrl, title){
    clearUI();
    base = deriveBase(fileUrl);

    // If the "cover" is a jpg, keep steps as png by default; user can override by adding ?ext=jpg
    try {
      const u = new URL(fileUrl, window.location.href);
      const paramExt = u.searchParams.get('ext');
      if (paramExt) ext = String(paramExt).replace('.', '').toLowerCase();
      else ext = 'png';
    } catch {
      ext = 'png';
    }

    // If caller passed a URL already ending with /1.png, allow that too
    if (fileUrl && /\/\d+\.(png|jpg|jpeg|webp)$/i.test(fileUrl)){
      base = deriveBase(fileUrl);
    }

    open();
    // Start scan (async)
    scanSteps();
  };

  // Close interactions
  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1, true);
    if (e.key === 'ArrowRight') show(idx + 1, true);
  });

  prevBtn.addEventListener('click', () => show(idx - 1, true));
  nextBtn.addEventListener('click', () => show(idx + 1, true));

  // Swipe (horizontal)
  let startX = 0, startY = 0, tracking = false;
  stage.addEventListener('pointerdown', (e) => {
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
  });
  stage.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    tracking = false;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dy) > Math.abs(dx)) return;
    const threshold = 40;
    if (dx <= -threshold) show(idx + 1, true);
    if (dx >= threshold) show(idx - 1, true);
  });
  stage.addEventListener('pointercancel', () => { tracking = false; });
})();
