(function(){
  const KEY = 'outrageart_cookie_consent_v1';

  function getConsent(){
    try{ return localStorage.getItem(KEY); }catch{ return null; }
  }
  function setConsent(value){
    try{ localStorage.setItem(KEY, value); }catch{}
  }
  function createBanner(){
    const wrap = document.createElement('div');
    wrap.id = 'cookieConsentBanner';
    wrap.style.position = 'fixed';
    wrap.style.left = '12px';
    wrap.style.right = '12px';
    wrap.style.bottom = '12px';
    wrap.style.zIndex = '9999';
    wrap.style.background = '#fff';
    wrap.style.border = '2px solid #000';
    wrap.style.padding = '10px';
    wrap.style.display = 'flex';
    wrap.style.flexWrap = 'wrap';
    wrap.style.gap = '8px';
    wrap.style.alignItems = 'center';
    wrap.innerHTML = [
      '<span style="font-size:13px; flex:1 1 280px;">',
      'Grab a cookie?',
      '</span>',
      '<button id="ccAccept" class="btn" type="button">Accept</button>',
      '<button id="ccDecline" class="btn ghost" type="button">Decline</button>'
    ].join('');
    document.body.appendChild(wrap);

    document.getElementById('ccAccept').addEventListener('click', () => {
      setConsent('accepted');
      wrap.remove();
    });
    document.getElementById('ccDecline').addEventListener('click', () => {
      setConsent('declined');
      wrap.remove();
    });
  }

  const current = getConsent();
  window.OA_COOKIE_CONSENT = current;
  window.oaHasCookieConsent = function(){
    try{ return localStorage.getItem(KEY) === 'accepted'; }catch{ return false; }
  };

  if (!current){
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', createBanner, { once:true });
    } else {
      createBanner();
    }
  }
})();
