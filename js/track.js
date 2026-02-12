(function(){
  const KEY_VISITOR = 'outrageart_visitor_id_v1';
  const KEY_SESSION = 'outrageart_track_sent_v1';

  function getVisitorId(){
    try{
      const existing = localStorage.getItem(KEY_VISITOR);
      if (existing) return existing;
      const created = (globalThis.crypto && globalThis.crypto.randomUUID)
        ? globalThis.crypto.randomUUID()
        : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY_VISITOR, created);
      return created;
    }catch{
      return `ephemeral_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  }

  function alreadySentThisSession(){
    try{
      return sessionStorage.getItem(KEY_SESSION) === '1';
    }catch{
      return false;
    }
  }

  function markSent(){
    try{ sessionStorage.setItem(KEY_SESSION, '1'); }catch{}
  }

  function track(){
    if (typeof window.oaHasCookieConsent === 'function' && !window.oaHasCookieConsent()) return;
    if (alreadySentThisSession()) return;

    const payload = {
      visitorId: getVisitorId(),
      path: location.pathname,
      host: location.host,
      referrer: document.referrer || ''
    };

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});

    markSent();
  }

  if (!location.pathname.toLowerCase().includes('analytics.html')) {
    track();
  }
})();
