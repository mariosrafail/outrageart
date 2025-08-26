// Netlify Forms — resilient AJAX with graceful fallback
(function(){
  const form  = document.getElementById('newsletterForm');
  const email = document.getElementById('nlEmail');
  const btn   = document.getElementById('nlSubmit');
  const help  = document.getElementById('nlHelp');
  if(!form || !email || !btn) return;

  const FORM_NAME = form.getAttribute('name') || 'newsletter';
  const ENDPOINT  = form.getAttribute('action') || '/'; // Netlify accepts POST to page or '/'

  function setStatus(text, ok = true){
    if (!help) return;
    help.textContent = text || '';
    help.style.color = ok ? 'var(--muted)' : '#c00';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if(!email.checkValidity()){
      email.focus();
      setStatus('Please enter a valid email address.', false);
      return;
    }

    // Build x-www-form-urlencoded body
    const fd = new FormData(form);
    if(!fd.get('form-name')) fd.append('form-name', FORM_NAME); // required by Netlify
    const body = new URLSearchParams(fd).toString();

    // UI busy state
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Signing up…';
    setStatus('');

    try{
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });

      // On Netlify, successful form POST often redirects to thanks.html
      if (res.ok || res.redirected) {
        form.reset();
        // If you prefer to actually go to the thanks page when Netlify redirects:
        // if (res.redirected) return window.location.assign(res.url);
        setStatus('Thanks! You’re on the list. 🎉');
      } else {
        // Fallback: do a normal HTML POST (works locally & on Netlify)
        form.submit();
      }
    } catch (err) {
      // Network/CORS/etc → fall back to normal form submission
      form.submit();
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });
})();
