const { getStore } = require('@netlify/blobs');

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
      const action = payload.action || 'increment';
      if (!id) return json(400, { error: 'Missing or invalid id' });
      if (action !== 'increment') return json(400, { error: 'Unsupported action' });

      const next = (await readViews(store, id)) + 1;
      await store.set(`item:${id}`, String(next));
      return json(200, { id, views: next });
    }

    return json(405, { error: 'Method not allowed' });
  }catch (err){
    return json(500, { error: 'Server error', detail: String(err && err.message || err) });
  }
};
