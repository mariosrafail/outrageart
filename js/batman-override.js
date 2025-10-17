
// batman-override.js — force Batman to open a single tall image (no slideshow)
(function(){
  function ensureOverlay(){
    if (document.getElementById('batmanOverlay')) return;
    var d=document.createElement('div');
    d.innerHTML=`<div id="batmanOverlay" class="batman-overlay" aria-hidden="true">
        <div class="batman-frame">
          <button class="btn small ghost batman-close" aria-label="Close">×</button>
          <img id="batmanVerticalImg" alt="Batman Vertical">
        </div>
      </div>`;
    document.body.appendChild(d.firstElementChild);
  }
  function injectStyles(){
    if(document.getElementById('batman-vertical-styles')) return;
    var s=document.createElement('style'); s.id='batman-vertical-styles'; s.textContent=`
.batman-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);display:none;z-index:9999}
.batman-overlay.is-open{display:block}
.batman-close{position:fixed;top:10px;right:10px;z-index:10000;background:#fff;color:#000;border-radius:6px;padding:4px 10px;font-weight:bold;opacity:0.9;transition:opacity 0.2s ease;}
.batman-close:hover{opacity:1;}
.batman-frame{position:absolute;top:0;bottom:0;left:0;right:0;margin:0 auto;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;background:#111;display:flex;justify-content:center;align-items:flex-start;padding-top:0}
@media (max-width:600px){.batman-frame img{width:100vw;height:auto;display:block;margin:0 auto;max-height:none!important;object-fit:unset!important}}
@media (min-width:601px){.batman-frame{width:600px}.batman-frame img{width:600px;height:auto;display:block;margin:0 auto;max-height:none!important;object-fit:unset!important}}`;
    document.head.appendChild(s);
    var snap=document.createElement('style'); snap.textContent=`/* snap rules */
@media (max-width:600px){.batman-frame{position:absolute;top:0;bottom:0;left:0;right:0;margin:0 auto;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;background:#111;display:flex;justify-content:center;align-items:flex-start;padding-top:0}.batman-frame img{scroll-snap-align:start}.batman-snap-end{flex:0 0 1px; width:1px; height:1px; scroll-snap-align:end}}
`; document.head.appendChild(snap);
    var g=document.createElement('style'); g.textContent=' .batman-frame img{max-height:none!important;object-fit:unset!important} '; document.head.appendChild(g);
  }
  function openBatman(url){
    ensureOverlay(); injectStyles();
    var ov=document.getElementById('batmanOverlay');
    var img=document.getElementById('batmanVerticalImg');
    img.src=url; ov.classList.add('is-open'); ov.setAttribute('aria-hidden','false');
    window.scrollTo({top:0,left:0,behavior:'instant'});
    var frame=document.querySelector('.batman-frame'); if(frame){ frame.scrollTop=0; }
    var frame=document.querySelector('.batman-frame'); if(frame){ frame.scrollTop=0; frame.scrollLeft=0; }
    window.scrollTo({top:0,left:0,behavior:'instant'});
  }
  function closeBatman(){
    var ov=document.getElementById('batmanOverlay');
    if(ov){ ov.classList.remove('is-open'); ov.setAttribute('aria-hidden','true'); }
  }
  document.addEventListener('click', function(e){
    if(e.target && (e.target.id==='batmanOverlay' || e.target.classList.contains('batman-close'))){ closeBatman(); }
  });

  function deriveVerticalFrom(url){
    try{ const u=new URL(url, location.href); const parts=u.pathname.split('/'); parts.pop(); parts.push('Batman_Vertical.png'); u.pathname=parts.join('/'); return u.toString(); }
    catch(e){ const base=url.split('?')[0].split('#')[0]; const i=base.lastIndexOf('/'); return i>-1? base.slice(0,i+1)+'Batman_Vertical.png' : 'Batman_Vertical.png'; }
  }

  // Intercept clicks after app.js binds its handler
  window.addEventListener('load', function(){
    var grid = document.getElementById('grid');
    if(!grid) return;
    grid.addEventListener('click', function(ev){
      const btn = ev.target.closest('.show-btn');
      if(!btn) return;
      // Detect Batman by closest card title or image src
      const card = btn.closest('article');
      const title = (card && (card.querySelector('h3')?.textContent||'')).trim().toLowerCase();
      const isBatman = title === 'batman' || (card && card.querySelector('img[src*="Batman" i]'));
      if(isBatman){
        ev.preventDefault();
        const verticalUrl = deriveVerticalFrom(btn.dataset.url || '');
        openBatman(verticalUrl);
        ev.stopImmediatePropagation(); // stop app.js slideshow handler
        return false;
      }
    }, true); // use capture to beat other handlers
  });
})();
