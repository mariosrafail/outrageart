(async function(){
  const TOKEN_KEY = 'outrageart_admin_token_v1';
  const $ = (id) => document.getElementById(id);
  const kpiVisits = $('kpiVisits');
  const kpiUnique = $('kpiUnique');
  const tblCountry = $('tblCountry');
  const tblSource = $('tblSource');
  const tblRef = $('tblRef');
  const tblDaily = $('tblDaily');
  const loginCard = $('loginCard');
  const dashboard = $('dashboard');
  const adminPassword = $('adminPassword');
  const btnAdminLogin = $('btnAdminLogin');
  const loginMsg = $('loginMsg');

  function num(n){ return Number(n || 0).toLocaleString(); }
  function getToken(){ try{ return sessionStorage.getItem(TOKEN_KEY) || ''; }catch{ return ''; } }
  function setToken(t){ try{ sessionStorage.setItem(TOKEN_KEY, t); }catch{} }
  function clearToken(){ try{ sessionStorage.removeItem(TOKEN_KEY); }catch{} }
  function showDashboard(){
    loginCard.style.display = 'none';
    dashboard.style.display = 'block';
  }
  function showLogin(msg){
    dashboard.style.display = 'none';
    loginCard.style.display = 'block';
    loginMsg.textContent = msg || '';
  }

  function fillTable(tbody, rows, cols){
    if (!rows || !rows.length){
      tbody.innerHTML = '<tr><td colspan="' + cols + '">No data yet</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => r).join('');
  }

  async function loadAnalytics(){
    const token = getToken();
    if (!token){
      showLogin('');
      return;
    }

    const res = await fetch('/api/analytics', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401){
      clearToken();
      showLogin('Session expired. Login again.');
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
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
  }

  btnAdminLogin.addEventListener('click', async () => {
    loginMsg.textContent = '';
    const password = (adminPassword.value || '').trim();
    if (!password){
      loginMsg.textContent = 'Type password';
      return;
    }

    try{
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok){
        showLogin('Invalid password');
        return;
      }
      const data = await res.json();
      if (!data.token){
        showLogin('Login failed');
        return;
      }
      setToken(data.token);
      adminPassword.value = '';
      await loadAnalytics();
    }catch{
      showLogin('Login failed');
    }
  });

  try{
    await loadAnalytics();
  }catch{
    const msg = '<tr><td colspan="3">Failed to load analytics</td></tr>';
    tblCountry.innerHTML = msg;
    tblSource.innerHTML = msg;
    tblRef.innerHTML = msg;
    tblDaily.innerHTML = msg;
    showLogin('Failed to load analytics');
  }
})();
