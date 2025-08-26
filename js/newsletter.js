// Netlify Forms – progressive enhancement (AJAX submit with fallback)
(function(){
  const form   = document.getElementById('newsletterForm');
  const email  = document.getElementById('nlEmail');
  const btn    = document.getElementById('nlSubmit');
  const help   = document.getElementById('nlHelp');
  if(!form || !email || !btn) return;

  function setStatus(text, ok = true){
    help.textContent = text || '';
    help.style.color = ok ? 'var(--muted)' : '#c00';
  }

  form.addEventListener('submit', async (e) => {
    // Keep normal POST to /thanks.html if JS breaks
    e.preventDefault();

    if(!email.checkValidity()){
      email.focus();
      setStatus('Please enter a valid email address.', false);
      return;
    }

    // Build body for Netlify (must include form-name)
    const fd = new FormData(form);
    if(!fd.get('form-name')) fd.append('form-name', form.getAttribute('name'));
    const body = new URLSearchParams(fd).toString();

    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Signing up…';
    setStatus('');

    try{
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });

      if(res.ok){
        form.reset();
        setStatus('Thanks! You’re on the list. 🎉');
      }else{
        throw new Error('Network response was not ok');
      }
    }catch(err){
      setStatus('Oops, something went wrong. Please try again.', false);
      // If you prefer fallback redirect on error:
      // form.submit();
    }finally{
      btn.disabled = false;
      btn.textContent = prev;
    }
  });
})();
