const { connectLambda, getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const STORE_NAME = 'doodle-views';
const COOKIE_NAME = 'oa_vid';

function json(statusCode, body, extraHeaders = {}){
  return {
    statusCode,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }, extraHeaders),
    body: JSON.stringify(body)
  };
}

function normalizeId(value){
  const id = String(value || '').trim();
  if (!/^\d+$/.test(id)) return null;
  return id;
}

async function readViews(store, id){
  const raw = await store.get(`item:${id}`, { type: 'text' });
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function parseCookies(cookieHeader){
  const out = {};
  const src = String(cookieHeader || '');
  if (!src) return out;
  src.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i <= 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function signViewerId(viewerId, secret){
  return crypto.createHmac('sha256', secret).update(viewerId).digest('hex');
}

function makeViewerToken(viewerId, secret){
  return `${viewerId}.${signViewerId(viewerId, secret)}`;
}

function parseViewerToken(token, secret){
  const t = String(token || '');
  const dot = t.indexOf('.');
  if (dot <= 0) return null;
  const viewerId = t.slice(0, dot);
  const sig = t.slice(dot + 1);
  if (!/^[a-f0-9]{32,128}$/i.test(viewerId)) return null;
  const expected = signViewerId(viewerId, secret);
  if (sig !== expected) return null;
  return viewerId;
}

function createViewerId(){
  return crypto.randomBytes(16).toString('hex');
}

function viewerHash(viewerId){
  return crypto.createHash('sha256').update(String(viewerId)).digest('hex');
}

exports.handler = async function handler(event){
  try{
    if (event.httpMethod === 'OPTIONS') return json(204, {});

    // Required in Netlify Lambda compatibility mode so Blobs context is available.
    connectLambda(event);
    const store = getStore(STORE_NAME);
    const cookieSecret = process.env.VIEW_COOKIE_SECRET || process.env.ADMIN_SESSION_SECRET;
    if (!cookieSecret) return json(500, { error: 'Missing VIEW_COOKIE_SECRET' });

    if (event.httpMethod === 'GET'){
      const id = normalizeId(event.queryStringParameters && event.queryStringParameters.id);
      if (!id) return json(400, { error: 'Missing or invalid id' });

      const views = await readViews(store, id);
      return json(200, { id, views });
    }

    if (event.httpMethod === 'POST'){
      const payload = event.body ? JSON.parse(event.body) : {};
      const id = normalizeId(payload.id);
      const action = payload.action || 'view';
      if (!id) return json(400, { error: 'Missing or invalid id' });
      if (action !== 'view') return json(400, { error: 'Unsupported action' });

      const cookies = parseCookies(event.headers && (event.headers.cookie || event.headers.Cookie));
      let viewerId = parseViewerToken(cookies[COOKIE_NAME], cookieSecret);
      let setCookieHeader = null;
      if (!viewerId){
        viewerId = createViewerId();
        const token = makeViewerToken(viewerId, cookieSecret);
        setCookieHeader = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
      }

      const seenKey = `seen:${id}:${viewerHash(viewerId)}`;
      const alreadySeen = await store.get(seenKey, { type: 'text' });

      if (alreadySeen){
        const current = await readViews(store, id);
        return json(200, { id, views: current, counted: false }, setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {});
      }

      const next = (await readViews(store, id)) + 1;
      await store.set(`item:${id}`, String(next));
      await store.set(seenKey, '1');
      return json(200, { id, views: next, counted: true }, setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {});
    }

    return json(405, { error: 'Method not allowed' });
  }catch (err){
    return json(500, { error: 'Server error', detail: String(err && err.message || err) });
  }
};
