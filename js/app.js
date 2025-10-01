let pageSize = 8;
let currentPage = 1;
let ALL_ITEMS = []; let filtered = []; let page = 0; let observer; let observing = false;
const grid = document.getElementById('grid');
const q = document.getElementById('q');
const diffSel = document.getElementById('difficulty');
const genderSel = document.getElementById('gender');
const themeSel = document.getElementById('theme');
const chips = document.getElementById('activeChips');
const count = document.getElementById('count');
const clearBtn = document.getElementById('clear');
const backToTop = document.getElementById('backtotop');
const viewer = document.getElementById('viewer');
const viewerImg = document.getElementById('viewerImg');
const viewerClose = document.getElementById('viewerClose');
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const sortKey = it => ((it.title && it.title.trim()) || it.url || it.thumb || "").toString();
const pageSizeSel = document.getElementById('pageSize');
const pager   = document.getElementById('pager');
const btnFirst = document.getElementById('btnFirst');
const btnPrev  = document.getElementById('btnPrev');
const btnNext  = document.getElementById('btnNext');
const btnLast  = document.getElementById('btnLast');
const pageInfo = document.getElementById('pageInfo');
// TOP pager
const pagerTop   = document.getElementById('pagerTop');
const btnFirstTop = document.getElementById('btnFirstTop');
const btnPrevTop  = document.getElementById('btnPrevTop');
const btnNextTop  = document.getElementById('btnNextTop');
const btnLastTop  = document.getElementById('btnLastTop');
const pageInfoTop = document.getElementById('pageInfoTop');
// Newsletter drop-down toggle
const nlSection = document.getElementById('newsletter');
const nlToggle  = document.getElementById('newsletterToggle');

if (nlSection && nlToggle){
  // ensure initial collapsed state (in case class missing)
  if (!nlSection.classList.contains('is-open')) {
    nlSection.classList.add('is-collapsed');
  }

  nlToggle.addEventListener('click', () => {
    const willOpen = !nlSection.classList.contains('is-open');
    nlSection.classList.toggle('is-open', willOpen);
    nlSection.classList.toggle('is-collapsed', !willOpen);
    nlToggle.setAttribute('aria-expanded', String(willOpen));
    if (willOpen){
      nlSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}



// Mobile filters toggle
const filtersToggle = document.getElementById('filtersToggle');
const controlsPanel = document.getElementById('controlsPanel');
if (filtersToggle && controlsPanel){
  filtersToggle.addEventListener('click', () => {
    const open = controlsPanel.classList.toggle('open');
    filtersToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // Ensure panel is visible on resize back to desktop
  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 761px)').matches){
      controlsPanel.classList.add('open');
      filtersToggle.setAttribute('aria-expanded','true');
    } else {
      controlsPanel.classList.remove('open');
      filtersToggle.setAttribute('aria-expanded','false');
    }
  });
  // Initialize state for current viewport
  if (window.matchMedia('(min-width: 761px)').matches){
    controlsPanel.classList.add('open');
    filtersToggle.setAttribute('aria-expanded','true');
  }
}

// Alpha sort helpers (locale-aware, handles numbers)
const basename = p => (p||'').split('?')[0].split('#')[0].split('/').pop() || (p||'');
// On touch devices, first tap shows the overlay; second tap hits the buttons
const isTouch = window.matchMedia('(hover:none), (pointer:coarse)').matches;

if (isTouch) {
  // tap on the image area toggles the overlay for that card
  grid.addEventListener('click', (e) => {
    const media = e.target.closest('.media');
    if (!media) return;

    const card = media.closest('.card');
    if (!card) return;

    // if overlay not open, open it and stop here
    if (!card.classList.contains('show-ov')) {
      e.preventDefault();
      // close any other open overlays
      grid.querySelectorAll('.card.show-ov').forEach(c => c.classList.remove('show-ov'));
      card.classList.add('show-ov');
    }
    // if already open, let the click proceed to the buttons
  });

  // tap outside closes any open overlay
  document.addEventListener('click', (e) => {
    if (e.target.closest('.media') || e.target.closest('.overlay')) return;
    grid.querySelectorAll('.card.show-ov').forEach(c => c.classList.remove('show-ov'));
  });
}



// Toggle visibility based on scroll
function updateBackToTop(){
  backToTop.classList.toggle('show', window.scrollY > 300);
}
window.addEventListener('scroll', updateBackToTop);

// Click → scroll to top
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));




function openViewer(url, title){
  viewerImg.src = url;
  viewerImg.alt = title || '';
  viewer.classList.add('show');
  viewer.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeViewer(){
  viewer.classList.remove('show');
  viewer.hidden = true;
  viewerImg.src = '';
  document.body.style.overflow = '';
}

// event delegation για τα Show buttons
grid.addEventListener('click', (e)=>{
  const btn = e.target.closest('.show-btn');
  if(btn){
    e.preventDefault();
    openViewer(btn.dataset.url, btn.dataset.title);
  }
});


/* ================= Click-to-Zoom + Follow-Mouse Pan (position-based) ================= */
let _zoom = 1;
let _tx = 0, _ty = 0;              // current translation
let _txTarget = 0, _tyTarget = 0;  // target translation (eased)
let _isZoomed = false;

// Ρυθμίσεις συμπεριφοράς
const EASING = 0.6;   // 0.2–0.35 = πιο “σβέλτο”, 0.15 = πιο smooth

const viewerContainer =
  (typeof viewerContent !== 'undefined' && viewerContent) ||
  viewerImg.closest('.viewer-content') ||
  viewerImg.parentElement;

viewerImg.style.touchAction = 'none';
viewerImg.style.transformOrigin = 'center center';

let _rafId = null;

function _applyTransform(){
  viewerImg.style.transform = `translate(${_tx}px, ${_ty}px) scale(${_zoom})`;
}

function _clampTargets(){
  const contRect = viewerContainer.getBoundingClientRect();
  const maxX = Math.max(0, (viewerImg.clientWidth  * _zoom - contRect.width)  / 2);
  const maxY = Math.max(0, (viewerImg.clientHeight * _zoom - contRect.height) / 2);
  if (_txTarget >  maxX) _txTarget =  maxX;
  if (_txTarget < -maxX) _txTarget = -maxX;
  if (_tyTarget >  maxY) _tyTarget =  maxY;
  if (_tyTarget < -maxY) _tyTarget = -maxY;
}

function _animate(){
  _tx += (_txTarget - _tx) * EASING;
  _ty += (_tyTarget - _ty) * EASING;
  _applyTransform();
  _rafId = requestAnimationFrame(_animate);
}
function _startAnim(){ if (_rafId == null) _rafId = requestAnimationFrame(_animate); }
function _stopAnim(){ if (_rafId != null){ cancelAnimationFrame(_rafId); _rafId = null; } }

// Χαρτογράφηση θέσης ποντικιού -> μετάφραση εικόνας (ακολουθεί το ποντίκι)
function _updateTargetsFromMouse(ev){
  if (!_isZoomed) return;

  const rect = viewerContainer.getBoundingClientRect();
  const contW = rect.width;
  const contH = rect.height;

  // ποσοστιαία θέση μέσα στο container [0..1]
  const px = Math.min(1, Math.max(0, (ev.clientX - rect.left) / contW));
  const py = Math.min(1, Math.max(0, (ev.clientY - rect.top)  / contH));

  // μέγιστη επιτρεπτή μετάφραση (με βάση το scale)
  const maxX = Math.max(0, (viewerImg.clientWidth  * _zoom - contW) / 2);
  const maxY = Math.max(0, (viewerImg.clientHeight * _zoom - contH) / 2);

  // αντιστοίχιση: αριστερό άκρο -> +maxX, δεξί άκρο -> -maxX (η εικόνα πάει προς το ποντίκι)
  _txTarget = (0.5 - px) * 2 * maxX * 1; // *1 = ευαισθησία· αύξησέ το αν θες πιο “γρήγορο”
  _tyTarget = (0.5 - py) * 2 * maxY * 1;

  _clampTargets();
}

// Toggle zoom με click
function _toggleZoom(){
  if (!_isZoomed){
    _zoom = 3; // άλλαξέ το αν θέλεις 2.5 ή 3
    _isZoomed = true;
    viewerImg.classList.add('is-zoomed');
    viewerImg.style.cursor = 'move';
    _tx = _ty = _txTarget = _tyTarget = 0;
    _applyTransform();
    _startAnim();
  } else {
    _isZoomed = false;
    _zoom = 1;
    _tx = _ty = _txTarget = _tyTarget = 0;
    viewerImg.classList.remove('is-zoomed');
    viewerImg.style.cursor = 'zoom-in';
    _applyTransform();
    _stopAnim();
  }
}

// Τύλιγμα open/close για reset
const _openViewer_orig = openViewer;
openViewer = function(url, title){
  _zoom = 1; _tx = 0; _ty = 0; _txTarget = 0; _tyTarget = 0; _isZoomed = false;
  viewerImg.classList.add('zoomable');
  viewerImg.classList.remove('is-zoomed');
  viewerImg.style.transform = 'none';
  viewerImg.style.cursor = 'zoom-in';
  _stopAnim();
  _openViewer_orig(url, title);
};
const _closeViewer_orig = closeViewer;
closeViewer = function(){
  _closeViewer_orig();
  _zoom = 1; _tx = 0; _ty = 0; _txTarget = 0; _tyTarget = 0; _isZoomed = false;
  viewerImg.classList.remove('is-zoomed');
  viewerImg.style.transform = 'none';
  viewerImg.style.cursor = 'zoom-in';
  _stopAnim();
};

// Κίνηση ποντικιού: ενημερώνει άμεσα τον στόχο, η εικόνα “πάει εκεί”
viewerImg.addEventListener('mousemove', _updateTargetsFromMouse);

// Click = toggle zoom (με μικρό anti-drag φίλτρο)
let _downX = 0, _downY = 0, _downTime = 0;
viewerImg.addEventListener('pointerdown', (ev) => {
  _downX = ev.clientX; _downY = ev.clientY; _downTime = performance.now();
});
viewerImg.addEventListener('pointerup', (ev) => {
  const moved = Math.hypot(ev.clientX - _downX, ev.clientY - _downY);
  const elapsed = performance.now() - _downTime;
  if (moved < 6 && elapsed < 250){ _toggleZoom(); }
});

// Accessibility: Enter/Space
viewer.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' || e.code === 'Space'){
    e.preventDefault();
    _toggleZoom();
  }
});

// Responsive/clamp updates
window.addEventListener('resize', () => { if (_isZoomed){ _clampTargets(); } });
viewerImg.addEventListener('load', () => {
  if (_isZoomed){
    _tx = _ty = _txTarget = _tyTarget = 0;
    _applyTransform();
    _clampTargets();
  } else {
    viewerImg.style.transform = 'none';
  }
});
/* ================= End Follow-Mouse Pan ================= */


// κλείσιμο με backdrop, X, ή ESC
viewer.addEventListener('click', (e)=>{
  if(e.target.classList.contains('viewer-backdrop')) closeViewer();
});
viewerClose.addEventListener('click', closeViewer);
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && !viewer.hidden) closeViewer();
});


const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const dots = level => {
  const lv = {easy:1, normal:2, medium:3, tricky:4, hard:5}[level] || 0;
  return `<span class="difficulty">${[1,2,3,4,5].map(i=>`<span class=dot style="display:inline-block; width:7px; height:7px; border-radius:50%; margin-left:2px; background:${i<=lv?'#ff4fd8':'#39425b'}"></span>`).join('')}</span>`;
};
const badge = text => `<span class="chip">${text}</span>`;

function safeName(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

function buildSrcset(thumb400){
  const m = thumb400.match(/^(.*)-400w\.(webp|jpe?g|png)$/i);
  if(!m) return '';
  const base = m[1], ext = m[2];
  return `${base}-300w.${ext} 300w, ${base}-400w.${ext} 400w, ${base}-600w.${ext} 600w`;
}

// js/app.js — ΑΝΤΙΚΑΤΑΣΤΑΣΗ της function card(item) με αυτήν εδώ:
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));}
function card(item){
  const tags = [...new Set([item.theme, item.gender, ...(item.tags||[])])].slice(0,4)
    .map(t=>`<span class=tag>${escapeHtml(t)}</span>`).join('');
  const srcset = buildSrcset(item.thumb);
  const fileUrl = item.url; // το ίδιο external link για Show & Download (Dropbox/Nextcloud/CDN)
  const title = escapeHtml(item.title || '');
  return `<article class="card" data-id="${item.id}" tabindex="0">
    <div class="media">
      <img loading="lazy" src="${item.thumb}" ${srcset ? `srcset="${srcset}" sizes="(max-width:600px) 50vw, 25vw"` : ''} alt="${title}">
      <div class="overlay">
        <button class="btn small ghost show-btn" data-url="${fileUrl}" data-title="${title}">Show</button>
        <a class="btn small primary" href="${fileUrl}" target="_self">Download</a>
      </div>
    </div>
    <div class="meta">
      <div class="row">
        <h3>${title}</h3>
        <span class="pill" title="${escapeHtml(item.difficulty)} difficulty">${dots(item.difficulty)}</span>
      </div>
      <div class="tags">${tags}</div>
    </div>
  </article>`;
}


function renderChunk(){
  const slice = filtered.slice(page*PAGE_SIZE, (page+1)*PAGE_SIZE);
  if(page === 0) grid.innerHTML = '';
  const frag = document.createElement('div');
  frag.innerHTML = slice.map(card).join('');
  grid.append(...frag.children);
  page++;
  count.textContent = `${filtered.length} item${filtered.length===1?'':'s'}`;
  if(page*PAGE_SIZE >= filtered.length){ stopObserving(); } else { startObserving(); }
  backToTop.classList.toggle('show', window.scrollY > 600);
}
function startObserving(){ if(observing) return; observer = new IntersectionObserver(e => { if(e[0].isIntersecting) renderChunk();}, {rootMargin:'600px'}); observer.observe(sentinel); observing = true; }
function stopObserving(){ if(observer){ observer.disconnect(); observer = null; } observing=false; }

function activeChips(){
  const c = [];
  if(q.value.trim()) c.push(`Search: <strong style=color:#000000>${q.value.trim()}</strong>`);
  if(diffSel.value) c.push(`Difficulty: <strong style=color:#000000>${cap(diffSel.value)}</strong>`);
  if(genderSel.value) c.push(`Character: <strong style=color:#000000>${cap(genderSel.value)}</strong>`);
  if(themeSel.value) c.push(`Theme: <strong style=color:#000000>${cap(themeSel.value)}</strong>`);
  chips.innerHTML = c.map(badge).join('');
}

function applyFilters(){
  const query = q.value.trim().toLowerCase();
  filtered = ALL_ITEMS.filter(it => {
    if(diffSel.value && it.difficulty !== diffSel.value) return false;
    if(genderSel.value && it.gender !== genderSel.value) return false;
    if(themeSel.value && it.theme !== themeSel.value) return false;
    if(query){
      const hay = [it.title, it.theme, it.gender].join(' ').toLowerCase(); // (tags removed)
      if(!hay.includes(query)) return false;
    }
    return true;
  });

  // 🔤 A→Z sort by title (fallback to file name)
  filtered.sort((a, b) => collator.compare(sortKey(a), sortKey(b)));

  activeChips();
  currentPage = 1;
  renderPage();
  renderPager();
  // updatePagerViews() is already called inside renderPage()
}



// group both pagers so we update them together
const pagers = [
  { wrap: pagerTop, first: btnFirstTop, prev: btnPrevTop, next: btnNextTop, last: btnLastTop, info: pageInfoTop },
  { wrap: pager,    first: btnFirst,    prev: btnPrev,    next: btnNext,    last: btnLast,    info: pageInfo }
];

function updatePagerViews(){
  const t = totalPages();
  pagers.forEach(p => {
    if(!p.wrap) return;
    p.wrap.style.display = t > 1 ? 'flex' : 'none';
    p.info.textContent = `Page ${currentPage} / ${t}`;
    p.first.disabled = currentPage <= 1;
    p.prev .disabled = currentPage <= 1;
    p.next .disabled = currentPage >= t;
    p.last .disabled = currentPage >= t;
  });
}



function populateThemeOptions(list){
  const set = new Set(list.map(i => i.theme));
  const opts = ['<option value="">Theme: All</option>', ...[...set].sort().map(t => `<option value="${t}">${cap(t)}</option>`)];
  themeSel.innerHTML = opts.join('');
}

// Events
backToTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
q.addEventListener('input', applyFilters);
[diffSel, genderSel, themeSel].forEach(el => el.addEventListener('change', applyFilters));
clearBtn.addEventListener('click', () => { q.value=''; diffSel.value=''; genderSel.value=''; themeSel.value=''; applyFilters(); });

btnFirst.addEventListener('click', () => gotoPage(1));
btnPrev .addEventListener('click', () => gotoPage(currentPage - 1));
btnNext .addEventListener('click', () => gotoPage(currentPage + 1));
btnLast .addEventListener('click', () => gotoPage(totalPages()));

pageSizeSel.addEventListener('change', () => {
  pageSize = parseInt(pageSizeSel.value, 10) || 8;
  currentPage = 1;
  renderPage();
  renderPager();
});


async function init(){
  document.getElementById('loading').style.display = 'block';
  try{
    const res = await fetch('data/items.json', {cache:'no-store'});
    ALL_ITEMS = await res.json();
  }catch(e){
    console.error(e);
    grid.innerHTML = '<div class=empty>Could not load data/items.json</div>'; return;
  }finally{
    document.getElementById('loading').style.display = 'none';
  }
  populateThemeOptions(ALL_ITEMS);
  applyFilters();
}
init();

function totalPages(){ return Math.max(1, Math.ceil(filtered.length / pageSize)); }

function renderPage(){
  const start = (currentPage - 1) * pageSize;
  const end   = start + pageSize;
  const slice = filtered.slice(start, end);

  if(slice.length === 0){
    grid.innerHTML = '<div class=empty>No results. Try clearing filters.</div>';
    count.textContent = '0 items';
    updatePagerViews();
    return;
  }

  const frag = document.createElement('div');
  frag.innerHTML = slice.map(card).join('');
  grid.innerHTML = '';
  grid.append(...frag.children);

  fitTitles();

  count.textContent = `${filtered.length} item${filtered.length === 1 ? '' : 's'}`;
  updatePagerViews();    
  updateBackToTop();     
}

function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
window.addEventListener('resize', debounce(() => fitTitles(), 150));


// Shrink long titles so they fit on one line (per card)
function fitTitles(scope = grid){
  const MAX = 16;   // starting font-size (px)
  const MIN = 11;   // smallest allowed (px)
  scope.querySelectorAll('.card .meta h3').forEach(h => {
    let size = MAX;
    h.style.fontSize = MAX + 'px';      // reset to max before measuring
    h.style.whiteSpace = 'nowrap';
    // reduce until it fits or hits MIN
    while (h.scrollWidth > h.clientWidth && size > MIN){
      size -= 1;
      h.style.fontSize = size + 'px';
    }
  });
}


function renderPager(){
  const t = totalPages();
  btnFirst.disabled = currentPage <= 1;
  btnPrev.disabled  = currentPage <= 1;
  btnNext.disabled  = currentPage >= t;
  btnLast.disabled  = currentPage >= t;
}

function gotoPage(n){
  const t = totalPages();
  currentPage = Math.min(Math.max(1, n), t);
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// TOP pager events
btnFirstTop.addEventListener('click', () => gotoPage(1));
btnPrevTop .addEventListener('click', () => gotoPage(currentPage - 1));
btnNextTop .addEventListener('click', () => gotoPage(currentPage + 1));
btnLastTop .addEventListener('click', () => gotoPage(totalPages()));