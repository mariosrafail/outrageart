(async function(){
  const $ = (id) => document.getElementById(id);
  const adminRoot = $('adminRoot');
  const loginCard = $('loginCard');
  const panel = $('panel');
  const loginMsg = $('loginMsg');
  const btnAdminLogin = $('btnAdminLogin');
  const btnAdminLogout = $('btnAdminLogout');
  const adminUsername = $('adminUsername');
  const adminPassword = $('adminPassword');
  const formTitle = $('formTitle');
  const formMsg = $('formMsg');
  const itemsBody = $('itemsBody');
  const mediaInfo = $('mediaInfo');
  const itemsSearch = $('itemsSearch');
  const itemsPrev = $('itemsPrev');
  const itemsNext = $('itemsNext');
  const itemsPageInfo = $('itemsPageInfo');

  const fields = {
    title: $('fTitle'),
    theme: $('fTheme'),
    gender: $('fGender'),
    difficulty: $('fDifficulty'),
    slug: $('fSlug'),
    urlOverride: $('fUrl'),
    thumbOverride: $('fThumb'),
    shop: $('fShop'),
    tags: $('fTags')
  };

  let editingId = null;
  let latestItems = [];
  let filteredItems = [];
  let page = 1;
  const PAGE_SIZE = 20;

  function showPanel(){
    adminRoot.classList.remove('auth-mode');
    loginCard.style.display = 'none';
    panel.style.display = 'block';
    btnAdminLogout.style.display = 'inline-block';
  }

  function showLogin(msg){
    adminRoot.classList.add('auth-mode');
    panel.style.display = 'none';
    loginCard.style.display = 'block';
    btnAdminLogout.style.display = 'none';
    loginMsg.textContent = msg || '';
  }

  function resetForm(){
    editingId = null;
    formTitle.textContent = 'Create Item';
    formMsg.textContent = '';
    Object.values(fields).forEach((el) => { el.value = ''; });
    fields.gender.value = 'male';
    fields.difficulty.value = 'normal';
  }

  function fillForm(item){
    editingId = item.id;
    formTitle.textContent = `Edit Item #${item.id}`;
    formMsg.textContent = '';
    fields.title.value = item.title || '';
    fields.theme.value = item.theme || '';
    fields.gender.value = item.gender || 'male';
    fields.difficulty.value = item.difficulty || 'normal';
    fields.slug.value = item.slug || '';
    fields.urlOverride.value = item.urlOverride || '';
    fields.thumbOverride.value = item.thumbOverride || '';
    fields.shop.value = item.shop || '';
    fields.tags.value = Array.isArray(item.tags) ? item.tags.join(', ') : '';
  }

  async function api(path, options){
    const res = await fetch(path, Object.assign({ credentials: 'same-origin' }, options || {}));
    const text = await res.text();
    let body = {};
    try{ body = text ? JSON.parse(text) : {}; }catch{}
    return { status: res.status, ok: res.ok, body };
  }

  function renderItems(items){
    latestItems = Array.isArray(items) ? items : [];
    applyListFilter();
  }

  function applyListFilter(){
    const q = (itemsSearch.value || '').trim().toLowerCase();
    filteredItems = latestItems.filter((it) => {
      if (!q) return true;
      const hay = `${it.title || ''} ${it.slug || ''} ${it.theme || ''}`.toLowerCase();
      return hay.includes(q);
    });
    page = 1;
    renderPage();
  }

  function renderPage(){
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * PAGE_SIZE;
    const slice = filteredItems.slice(start, start + PAGE_SIZE);

    if (!slice.length){
      itemsBody.innerHTML = '<tr><td colspan="4">No items</td></tr>';
      itemsPrev.disabled = true;
      itemsNext.disabled = true;
      itemsPageInfo.textContent = 'Page 1 / 1';
      return;
    }

    itemsBody.innerHTML = slice.map((it) => (
      `<tr>
        <td>${escapeHtml(it.title || '')}</td>
        <td>${escapeHtml(it.slug || '')}</td>
        <td>${escapeHtml(it.theme || '')}</td>
        <td>
          <div class="actions">
            <button class="btn ghost btn-edit" type="button" data-id="${it.id}">Edit</button>
            <button class="btn ghost btn-del" type="button" data-id="${it.id}">Delete</button>
          </div>
        </td>
      </tr>`
    )).join('');
    itemsPrev.disabled = page <= 1;
    itemsNext.disabled = page >= totalPages;
    itemsPageInfo.textContent = `Page ${page} / ${totalPages}`;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  }

  async function loadItems(){
    const res = await api('/api/admin-items', { method: 'GET', cache: 'no-store' });
    if (res.status === 401){
      showLogin('Login required.');
      return;
    }
    if (!res.ok) throw new Error('Failed to load items');
    showPanel();
    const media = res.body && res.body.media ? res.body.media : {};
    mediaInfo.textContent = `Media base: ${media.artBaseUrl || '-'} | Thumbs base: ${media.thumbBaseUrl || '-'}`;
    renderItems(res.body.items || []);
  }

  btnAdminLogin.addEventListener('click', async () => {
    loginMsg.textContent = '';
    const username = (adminUsername.value || '').trim();
    const password = (adminPassword.value || '').trim();
    if (!username || !password){
      loginMsg.textContent = 'Type username and password';
      return;
    }
    const res = await api('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok){
      loginMsg.textContent = res.status === 429 ? 'Too many attempts. Try later.' : 'Invalid credentials';
      return;
    }
    adminPassword.value = '';
    await loadItems();
  });

  btnAdminLogout.addEventListener('click', async () => {
    try{ await api('/api/admin-logout', { method: 'POST' }); }catch{}
    showLogin('Logged out.');
  });

  $('btnReset').addEventListener('click', resetForm);

  $('btnSave').addEventListener('click', async () => {
    formMsg.textContent = '';
    const payload = {
      title: (fields.title.value || '').trim(),
      theme: (fields.theme.value || '').trim(),
      gender: (fields.gender.value || '').trim(),
      difficulty: (fields.difficulty.value || '').trim(),
      slug: (fields.slug.value || '').trim(),
      urlOverride: (fields.urlOverride.value || '').trim(),
      thumbOverride: (fields.thumbOverride.value || '').trim(),
      shop: (fields.shop.value || '').trim(),
      tags: (fields.tags.value || '').split(',').map(v => v.trim()).filter(Boolean)
    };

    if (!payload.title || !payload.theme || !payload.gender || !payload.difficulty || !payload.slug){
      formMsg.textContent = 'Fill required fields.';
      return;
    }

    if (editingId) payload.id = editingId;
    const method = editingId ? 'PUT' : 'POST';
    const res = await api('/api/admin-items', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok){
      formMsg.textContent = res.body && res.body.error ? res.body.error : 'Save failed';
      return;
    }
    formMsg.textContent = editingId ? 'Updated.' : 'Created.';
    resetForm();
    await loadItems();
  });

  itemsBody.addEventListener('click', async (ev) => {
    const editBtn = ev.target.closest('.btn-edit');
    if (editBtn){
      const id = Number(editBtn.dataset.id);
      const item = latestItems.find(x => Number(x.id) === id);
      if (item) fillForm(item);
      return;
    }
    const delBtn = ev.target.closest('.btn-del');
    if (delBtn){
      const id = Number(delBtn.dataset.id);
      if (!window.confirm(`Delete item #${id}?`)) return;
      const res = await api('/api/admin-items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!res.ok){
        formMsg.textContent = res.body && res.body.error ? res.body.error : 'Delete failed';
        return;
      }
      if (editingId === id) resetForm();
      await loadItems();
    }
  });

  [adminUsername, adminPassword].forEach((el) => {
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') btnAdminLogin.click();
    });
  });

  itemsSearch.addEventListener('input', applyListFilter);
  itemsPrev.addEventListener('click', () => { if (page > 1){ page -= 1; renderPage(); } });
  itemsNext.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    if (page < totalPages){ page += 1; renderPage(); }
  });

  try{
    await loadItems();
  }catch{
    showLogin('Failed to load admin data.');
  }
})();
