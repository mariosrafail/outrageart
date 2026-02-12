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
  const chartRangeControls = $('chartRangeControls');
  const nextRefreshInfo = $('nextRefreshInfo');
  let athensDateKeyAtLastLoad = null;
  let minuteWatcherId = null;
  let latestDailyRows = [];
  let latestDailyMapRows = [];
  let chartHoverIndex = null;
  let chartMeta = null;
  let selectedRangeDays = 28;

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

  function buildLastNDaysKeys(days){
    const todayKey = getAthensDateKey();
    const parts = todayKey.split('-').map(Number);
    const baseUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    const out = [];

    for (let i = days - 1; i >= 0; i--){
      const d = new Date(baseUtc - (i * 86400000));
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      out.push(`${y}-${m}-${day}`);
    }
    return out;
  }

  function normalizeDailyRows(rawRows, days){
    const rowMap = new Map();
    (Array.isArray(rawRows) ? rawRows : []).forEach((row) => {
      const key = String(row && row.date || '');
      if (!key) return;
      rowMap.set(key, {
        date: key,
        visits: Number(row && row.visits || 0),
        uniqueVisitors: Number(row && row.uniqueVisitors || 0)
      });
    });

    const safeDays = Math.max(1, Number(days || 28));
    const keys = buildLastNDaysKeys(safeDays);
    const out = keys.map((key) => {
      const existing = rowMap.get(key);
      if (existing) return existing;
      return { date: key, visits: 0, uniqueVisitors: 0 };
    });

    return out;
  }

  function drawHoverLabel(ctx, x, y, text, bounds){
    const padX = 8;
    const boxH = 20;
    const tw = Math.ceil(ctx.measureText(text).width);
    const boxW = tw + (padX * 2);
    const bxMin = bounds.left;
    const bxMax = bounds.right - boxW;
    const byMin = bounds.top;
    const byMax = bounds.bottom - boxH;
    const bx = Math.max(bxMin, Math.min(bxMax, Math.round(x - (boxW / 2))));
    const by = Math.max(byMin, Math.min(byMax, Math.round(y - boxH - 10)));

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(bx, by, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(text, bx + padX, by + 14);
  }

  function drawDailyChart(rows, hoverIndex = null){
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
    chartMeta = { pad, w, count };
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

    if (hoverIndex == null || hoverIndex < 0 || hoverIndex >= count) return;

    const idx = hoverIndex;
    const hx = xAt(idx);
    const hv = views[idx] || 0;
    const hu = unique[idx] || 0;
    const yv = yAt(hv);
    const yu = yAt(hu);

    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, pad.top);
    ctx.lineTo(hx, pad.top + h);
    ctx.stroke();

    function drawPoint(x, y, color){
      ctx.beginPath();
      ctx.fillStyle = '#fff';
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    drawPoint(hx, yv, '#ef4444');
    drawPoint(hx, yu, '#2563eb');

    const tip = `${num(hv)} views, ${num(hu)} unique`;
    const tipY = Math.min(yv, yu);
    drawHoverLabel(ctx, hx, tipY, tip, {
      left: pad.left,
      right: pad.left + w,
      top: pad.top,
      bottom: pad.top + h
    });
  }

  function bindChartHover(){
    if (!chartCanvas) return;
    chartCanvas.addEventListener('mousemove', (ev) => {
      if (!chartMeta || !latestDailyRows.length) return;
      const rect = chartCanvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const { pad, w, count } = chartMeta;
      if (x < pad.left || x > (pad.left + w)){
        if (chartHoverIndex !== null){
          chartHoverIndex = null;
          drawDailyChart(latestDailyRows, null);
          setNextRefreshLabel();
        }
        return;
      }
      const idxRaw = count <= 1 ? 0 : Math.round(((x - pad.left) / w) * (count - 1));
      const idx = Math.max(0, Math.min(count - 1, idxRaw));
      if (idx === chartHoverIndex) return;
      chartHoverIndex = idx;
      drawDailyChart(latestDailyRows, chartHoverIndex);
    });

    chartCanvas.addEventListener('mouseleave', () => {
      chartHoverIndex = null;
      drawDailyChart(latestDailyRows, null);
      setNextRefreshLabel();
    });
  }

  function setActiveRangeButton(){
    if (!chartRangeControls) return;
    chartRangeControls.querySelectorAll('[data-range-days]').forEach((btn) => {
      const days = Number(btn.getAttribute('data-range-days'));
      btn.classList.toggle('active', days === selectedRangeDays);
    });
  }

  function renderDailyFromRange(){
    latestDailyRows = normalizeDailyRows(latestDailyMapRows, selectedRangeDays);
    chartHoverIndex = null;
    setActiveRangeButton();

    fillTable(
      tblDaily,
      latestDailyRows.map(x => `<tr><td>${x.date}</td><td>${num(x.visits)}</td><td>${num(x.uniqueVisitors)}</td></tr>`),
      3
    );
    drawDailyChart(latestDailyRows, null);
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
    latestDailyMapRows = Array.isArray(data.dailyLast30) ? data.dailyLast30 : [];
    renderDailyFromRange();
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

  if (chartRangeControls){
    chartRangeControls.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-range-days]');
      if (!btn) return;
      const days = Number(btn.getAttribute('data-range-days'));
      if (!Number.isFinite(days) || days <= 0) return;
      selectedRangeDays = days;
      renderDailyFromRange();
    });
  }

  try{
    bindChartHover();
    await loadAnalytics();
    window.addEventListener('resize', () => drawDailyChart(latestDailyRows, chartHoverIndex));
  }catch{
    const msg = '<tr><td colspan="3">Failed to load analytics</td></tr>';
    tblCountry.innerHTML = msg;
    tblSource.innerHTML = msg;
    tblRef.innerHTML = msg;
    tblDaily.innerHTML = msg;
    showLogin('Failed to load analytics');
  }
})();
