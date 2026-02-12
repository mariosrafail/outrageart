(async function(){
  const $ = (id) => document.getElementById(id);
  const kpiVisits = $('kpiVisits');
  const kpiUnique = $('kpiUnique');
  const tblCountry = $('tblCountry');
  const tblSource = $('tblSource');
  const tblRef = $('tblRef');
  const tblDaily = $('tblDaily');
  const analyticsRoot = $('analyticsRoot');
  const loginCard = $('loginCard');
  const dashboard = $('dashboard');
  const adminUsername = $('adminUsername');
  const adminPassword = $('adminPassword');
  const btnAdminLogin = $('btnAdminLogin');
  const btnAdminLogout = $('btnAdminLogout');
  const loginMsg = $('loginMsg');
  const chartCanvas = $('dailyLineChart');
  const nextRefreshInfo = $('nextRefreshInfo');
  let athensDateKeyAtLastLoad = null;
  let minuteWatcherId = null;
  let latestDailyRows = [];

  function num(n){ return Number(n || 0).toLocaleString(); }
  function showDashboard(){
    if (analyticsRoot) analyticsRoot.classList.remove('auth-mode');
    loginCard.style.display = 'none';
    dashboard.style.display = 'block';
    if (btnAdminLogout) btnAdminLogout.style.display = 'inline-block';
  }
  function showLogin(msg){
    if (analyticsRoot) analyticsRoot.classList.add('auth-mode');
    dashboard.style.display = 'none';
    loginCard.style.display = 'block';
    if (btnAdminLogout) btnAdminLogout.style.display = 'none';
    loginMsg.textContent = msg || '';
  }

  function fillTable(tbody, rows, cols){
    if (!rows || !rows.length){
      tbody.innerHTML = '<tr><td colspan="' + cols + '">No data yet</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => r).join('');
  }

  function getAthensParts(){
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Athens',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute)
    };
  }

  function getAthensDateKey(){
    const p = getAthensParts();
    const mm = String(p.month).padStart(2, '0');
    const dd = String(p.day).padStart(2, '0');
    return `${p.year}-${mm}-${dd}`;
  }

  function setNextRefreshLabel(){
    if (!nextRefreshInfo) return;
    nextRefreshInfo.textContent = 'Auto refresh at 00:00 (Europe/Athens)';
  }

  function drawDailyChart(rows){
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) return;

    const cssWidth = chartCanvas.clientWidth || 1000;
    const cssHeight = chartCanvas.clientHeight || 280;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    chartCanvas.width = Math.floor(cssWidth * dpr);
    chartCanvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const pad = { top: 14, right: 14, bottom: 28, left: 42 };
    const w = cssWidth - pad.left - pad.right;
    const h = cssHeight - pad.top - pad.bottom;
    if (w <= 10 || h <= 10) return;

    const safeRows = Array.isArray(rows) ? rows : [];
    const labels = safeRows.map(r => String(r.date || '').slice(5));
    const views = safeRows.map(r => Number(r.visits || 0));
    const unique = safeRows.map(r => Number(r.uniqueVisitors || 0));
    const maxY = Math.max(5, ...views, ...unique);

    ctx.strokeStyle = '#e6e6e6';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++){
      const y = pad.top + (h * i / 4);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#666';
    ctx.font = '11px Inter, sans-serif';
    for (let i = 0; i <= 4; i++){
      const v = Math.round(maxY - (maxY * i / 4));
      const y = pad.top + (h * i / 4) + 4;
      ctx.fillText(String(v), 6, y);
    }

    const count = safeRows.length;
    const xAt = (idx) => {
      if (count <= 1) return pad.left;
      return pad.left + (w * idx / (count - 1));
    };
    const yAt = (val) => pad.top + h - ((val / maxY) * h);

    function drawLine(values, color){
      if (!values.length) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = xAt(i);
        const y = yAt(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    drawLine(views, '#ef4444');
    drawLine(unique, '#2563eb');

    ctx.fillStyle = '#777';
    const step = Math.max(1, Math.ceil(count / 6));
    for (let i = 0; i < count; i += step){
      const x = xAt(i);
      const label = labels[i] || '';
      ctx.fillText(label, x - 14, pad.top + h + 16);
    }
    if (count > 1){
      const lx = xAt(count - 1);
      const label = labels[count - 1] || '';
      ctx.fillText(label, lx - 14, pad.top + h + 16);
    }
  }

  function armMidnightRefresh(){
    if (minuteWatcherId) clearInterval(minuteWatcherId);

    setNextRefreshLabel();
    minuteWatcherId = setInterval(async () => {
      const todayAthens = getAthensDateKey();
      if (athensDateKeyAtLastLoad && todayAthens !== athensDateKeyAtLastLoad){
        try{ await loadAnalytics(); }catch{}
      }
    }, 60000);
  }

  async function loadAnalytics(){
    const res = await fetch('/api/analytics', {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (res.status === 401){
      showLogin('Login required.');
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    athensDateKeyAtLastLoad = getAthensDateKey();
    showDashboard();

    kpiVisits.textContent = num(data?.totals?.totalVisits);
    kpiUnique.textContent = num(data?.totals?.uniqueVisitors);

    fillTable(
      tblCountry,
      (data.byCountry || []).map(x => `<tr><td>${x.key.toUpperCase()}</td><td>${num(x.value)}</td></tr>`),
      2
    );
    fillTable(
      tblSource,
      (data.bySource || []).map(x => `<tr><td>${x.key}</td><td>${num(x.value)}</td></tr>`),
      2
    );
    fillTable(
      tblRef,
      (data.byReferrerHost || []).map(x => `<tr><td>${x.key}</td><td>${num(x.value)}</td></tr>`),
      2
    );
    fillTable(
      tblDaily,
      (data.dailyLast30 || []).map(x => `<tr><td>${x.date}</td><td>${num(x.visits)}</td><td>${num(x.uniqueVisitors)}</td></tr>`),
      3
    );
    latestDailyRows = data.dailyLast30 || [];
    drawDailyChart(latestDailyRows);
    armMidnightRefresh();
  }

  btnAdminLogin.addEventListener('click', async () => {
    loginMsg.textContent = '';
    const username = (adminUsername && adminUsername.value ? adminUsername.value : 'adminrage').trim();
    const password = (adminPassword.value || '').trim();
    if (!username){
      loginMsg.textContent = 'Type username';
      return;
    }
    if (!password){
      loginMsg.textContent = 'Type password';
      return;
    }

    try{
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password })
      });
      if (!res.ok){
        if (res.status === 429){
          showLogin('Too many attempts. Try again later.');
          return;
        }
        showLogin('Invalid credentials');
        return;
      }
      await res.json();
      if (adminUsername) adminUsername.value = 'adminrage';
      adminPassword.value = '';
      await loadAnalytics();
    }catch{
      showLogin('Login failed');
    }
  });

  [adminUsername, adminPassword].forEach((el) => {
    if (!el) return;
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') btnAdminLogin.click();
    });
  });

  if (btnAdminLogout){
    btnAdminLogout.addEventListener('click', async () => {
      try{
        await fetch('/api/admin-logout', { method:'POST', credentials:'same-origin' });
      }catch{}
      showLogin('Logged out.');
    });
  }

  try{
    await loadAnalytics();
    window.addEventListener('resize', () => drawDailyChart(latestDailyRows));
  }catch{
    const msg = '<tr><td colspan="3">Failed to load analytics</td></tr>';
    tblCountry.innerHTML = msg;
    tblSource.innerHTML = msg;
    tblRef.innerHTML = msg;
    tblDaily.innerHTML = msg;
    showLogin('Failed to load analytics');
  }
})();
