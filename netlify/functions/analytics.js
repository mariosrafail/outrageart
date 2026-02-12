const { connectLambda, getStore } = require('@netlify/blobs');

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

exports.handler = async function handler(event){
  try{
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

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
