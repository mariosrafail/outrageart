const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const STORE_NAME = 'doodle-views';

function json(statusCode, body){
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
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

function normalizeViewerId(value){
  const viewerId = String(value || '').trim();
  if (!viewerId || viewerId.length > 200) return null;
  return viewerId;
}

function viewerHash(viewerId){
  return crypto.createHash('sha256').update(viewerId).digest('hex');
}

exports.handler = async function handler(event){
  try{
    if (event.httpMethod === 'OPTIONS') return json(204, {});

    const store = getStore(STORE_NAME);

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
      const viewerId = normalizeViewerId(payload.viewerId);
      if (!id) return json(400, { error: 'Missing or invalid id' });
      if (action !== 'view') return json(400, { error: 'Unsupported action' });
      if (!viewerId) return json(400, { error: 'Missing or invalid viewerId' });

      const seenKey = `seen:${id}:${viewerHash(viewerId)}`;
      const alreadySeen = await store.get(seenKey, { type: 'text' });

      if (alreadySeen){
        const current = await readViews(store, id);
        return json(200, { id, views: current, counted: false });
      }

      const next = (await readViews(store, id)) + 1;
      await store.set(`item:${id}`, String(next));
      await store.set(seenKey, '1');
      return json(200, { id, views: next, counted: true });
    }

    return json(405, { error: 'Method not allowed' });
  }catch (err){
    return json(500, { error: 'Server error', detail: String(err && err.message || err) });
  }
};
