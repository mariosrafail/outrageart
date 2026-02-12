const { connectLambda, getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const STORE_NAME = 'site-analytics';
const STATS_KEY = 'stats:v1';

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

function toObject(value){
  return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
}

function toInt(value){
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function sortMap(mapObj, limit = 20){
  return Object.entries(toObject(mapObj))
    .map(([key, value]) => ({ key, value: toInt(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function fromBase64url(input){
  const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function verifyToken(token, secret){
  const [data, sig] = String(token || '').split('.');
  if (!data || !sig) return null;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  if (sig !== expected) return null;

  let payload;
  try{
    payload = JSON.parse(fromBase64url(data));
  }catch{
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (!payload || payload.role !== 'admin' || !payload.exp || payload.exp < now) return null;
  return payload;
}

exports.handler = async function handler(event){
  try{
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

    const sessionSecret = process.env.ADMIN_SESSION_SECRET;
    if (!sessionSecret) return json(500, { error: 'Missing admin env vars' });

    const auth = String((event.headers && (event.headers.authorization || event.headers.Authorization)) || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const claims = verifyToken(token, sessionSecret);
    if (!claims) return json(401, { error: 'Unauthorized' });

    connectLambda(event);
    const store = getStore(STORE_NAME);
    const stats = toObject(await store.get(STATS_KEY, { type: 'json' }));
    const daily = toObject(stats.daily);

    const last30 = Object.entries(daily)
      .map(([date, row]) => ({
        date,
        visits: toInt(row && row.visits),
        uniqueVisitors: toInt(row && row.uniqueVisitors)
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    return json(200, {
      totals: {
        totalVisits: toInt(stats.totalVisits),
        uniqueVisitors: toInt(stats.uniqueVisitors)
      },
      byCountry: sortMap(stats.byCountry, 30),
      bySource: sortMap(stats.bySource, 20),
      byReferrerHost: sortMap(stats.byReferrerHost, 30),
      dailyLast30: last30
    });
  }catch (err){
    return json(500, { error: 'Server error', detail: String(err && err.message || err) });
  }
};
