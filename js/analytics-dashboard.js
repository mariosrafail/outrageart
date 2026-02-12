(async function(){
  const $ = (id) => document.getElementById(id);

  const kpiClicks = $('kpiClicks');
  const kpiImpressions = $('kpiImpressions');
  const kpiCtr = $('kpiCtr');
  const kpiPosition = $('kpiPosition');

  const tableTitle = $('tableTitle');
  const tableHead = $('tableHead');
  const tableBody = $('tableBody');
  const rangeControls = $('rangeControls');
  const dimensionTabs = $('dimensionTabs');
  const searchTypeBtn = $('searchTypeBtn');
  const addFilterBtn = $('addFilterBtn');

  const analyticsRoot = $('analyticsRoot');
  const loginCard = $('loginCard');
  const dashboard = $('dashboard');
  const adminUsername = $('adminUsername');
  const adminPassword = $('adminPassword');
  const btnAdminLogin = $('btnAdminLogin');
  const btnAdminLogout = $('btnAdminLogout');
  const loginMsg = $('loginMsg');
  const nextRefreshInfo = $('nextRefreshInfo');

  let athensDateKeyAtLastLoad = null;
  let minuteWatcherId = null;
  let analyticsData = null;

  const state = {
    range: '90',
    tab: 'queries'
  };

  function num(n){
    return Number(n || 0).toLocaleString();
  }

  function esc(v){
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
    nextRefreshInfo.textContent = 'Last update: just now. Auto refresh at 00:00 (Europe/Athens)';
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

  function getFilteredDays(rows){
    const safeRows = Array.isArray(rows) ? rows : [];
    if (state.range === 'all') return safeRows;
    const days = Number(state.range || 0);
    if (!Number.isFinite(days) || days <= 0) return safeRows;
    return safeRows.slice(-days);
  }

  function metricFromRows(rows){
    const clicks = rows.reduce((sum, row) => sum + Number(row && row.visits || 0), 0);
    const impressions = rows.reduce((sum, row) => sum + Number(row && row.uniqueVisitors || 0), 0);
    const ctr = impressions > 0 ? ((clicks / impressions) * 100) : 0;
    return {
      clicks,
      impressions,
      ctr
    };
  }

  function getTabConfig(data, filteredDays){
    const bySource = Array.isArray(data && data.bySource) ? data.bySource : [];
    const byReferrerHost = Array.isArray(data && data.byReferrerHost) ? data.byReferrerHost : [];
    const byCountry = Array.isArray(data && data.byCountry) ? data.byCountry : [];

    const tabMap = {
      queries: {
        title: 'Top queries',
        headers: ['Query', 'Clicks'],
        rows: bySource.map(x => [x.key, num(x.value)])
      },
      pages: {
        title: 'Top pages',
        headers: ['Page', 'Clicks'],
        rows: byReferrerHost.map(x => [x.key, num(x.value)])
      },
      countries: {
        title: 'Top countries',
        headers: ['Country', 'Clicks'],
        rows: byCountry.map(x => [String(x.key || '').toUpperCase(), num(x.value)])
      },
      devices: {
        title: 'Top devices',
        headers: ['Device', 'Clicks'],
        rows: []
      },
      appearance: {
        title: 'Search appearance',
        headers: ['Appearance', 'Clicks'],
        rows: []
      },
      days: {
        title: 'Top days',
        headers: ['Date', 'Clicks', 'Impressions'],
        rows: filteredDays.slice().reverse().map(x => [x.date, num(x.visits), num(x.uniqueVisitors)])
      }
    };

    return tabMap[state.tab] || tabMap.queries;
  }

  function renderTable(config){
    tableTitle.textContent = config.title;
    tableHead.innerHTML = `<tr>${config.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;

    if (!config.rows.length){
      tableBody.innerHTML = `<tr><td colspan="${config.headers.length}">No data yet</td></tr>`;
      return;
    }

    tableBody.innerHTML = config.rows
      .map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`)
      .join('');
  }

  function refreshRangeButtons(){
    if (!rangeControls) return;
    const buttons = rangeControls.querySelectorAll('[data-range]');
    buttons.forEach((btn) => {
      const isActive = btn.getAttribute('data-range') === state.range;
      btn.classList.toggle('active', isActive);
    });
  }

  function refreshTabs(){
    if (!dimensionTabs) return;
    const tabs = dimensionTabs.querySelectorAll('[data-tab]');
    tabs.forEach((tab) => {
      const isActive = tab.getAttribute('data-tab') === state.tab;
      tab.classList.toggle('active', isActive);
    });
  }

  function renderDashboard(){
    if (!analyticsData) return;

    const filteredDays = getFilteredDays(analyticsData.dailyLast30 || []);
    const metrics = metricFromRows(filteredDays);

    kpiClicks.textContent = num(metrics.clicks);
    kpiImpressions.textContent = num(metrics.impressions);
    kpiCtr.textContent = `${metrics.ctr.toFixed(1)}%`;
    kpiPosition.textContent = '-';

    renderTable(getTabConfig(analyticsData, filteredDays));
    refreshRangeButtons();
    refreshTabs();
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

    analyticsData = await res.json();
    athensDateKeyAtLastLoad = getAthensDateKey();

    showDashboard();
    renderDashboard();
    armMidnightRefresh();
  }

  if (rangeControls){
    rangeControls.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-range]');
      if (!btn) return;
      state.range = btn.getAttribute('data-range') || '90';
      renderDashboard();
    });
  }

  if (dimensionTabs){
    dimensionTabs.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-tab]');
      if (!btn) return;
      state.tab = btn.getAttribute('data-tab') || 'queries';
      renderDashboard();
    });
  }

  if (searchTypeBtn){
    searchTypeBtn.addEventListener('click', () => {
      searchTypeBtn.textContent = 'Search type: Web';
    });
  }

  if (addFilterBtn){
    addFilterBtn.addEventListener('click', () => {
      if (loginMsg) loginMsg.textContent = '';
    });
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
  }catch{
    showLogin('Failed to load analytics');
    tableHead.innerHTML = '<tr><th>Metric</th><th>Value</th></tr>';
    tableBody.innerHTML = '<tr><td colspan="2">Failed to load analytics</td></tr>';
  }
})();
