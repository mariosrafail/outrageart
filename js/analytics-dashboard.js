(async function(){
  const $ = (id) => document.getElementById(id);
  const kpiVisits = $('kpiVisits');
  const kpiUnique = $('kpiUnique');
  const tblCountry = $('tblCountry');
  const tblSource = $('tblSource');
  const tblRef = $('tblRef');
  const tblDaily = $('tblDaily');

  function num(n){ return Number(n || 0).toLocaleString(); }

  function fillTable(tbody, rows, cols){
    if (!rows || !rows.length){
      tbody.innerHTML = '<tr><td colspan="' + cols + '">No data yet</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => r).join('');
  }

  try{
    const res = await fetch('/api/analytics', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

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
  }catch (e){
    const msg = '<tr><td colspan="3">Failed to load analytics</td></tr>';
    tblCountry.innerHTML = msg;
    tblSource.innerHTML = msg;
    tblRef.innerHTML = msg;
    tblDaily.innerHTML = msg;
  }
})();
