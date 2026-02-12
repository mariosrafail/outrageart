const crypto = require('crypto');
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

function normalizeVisitorId(value){
  const id = String(value || '').trim();
  if (!id || id.length > 200) return null;
  return id;
}

function getAthensDateKey(){
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return fmt.format(new Date());
}

function hash(value){
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function incMap(mapObj, key){
  const k = String(key || 'unknown').toLowerCase();
  mapObj[k] = toInt(mapObj[k]) + 1;
}

function getCountryFromHeaders(headers){
  const rawGeo = headers['x-nf-geo'];
  if (rawGeo){
    try{
      const geo = JSON.parse(rawGeo);
      const code =
        geo?.country?.code ||
        geo?.country_code ||
        geo?.country;
      if (code) return String(code).toUpperCase();
    }catch{}
  }

  const headerCandidates = [
    headers['x-country'],
    headers['cf-ipcountry'],
    headers['x-vercel-ip-country']
  ];
  for (const c of headerCandidates){
    if (c) return String(c).toUpperCase();
  }
  return 'UNKNOWN';
}

function normalizeHost(raw){
  if (!raw) return '';
  try{
    const url = new URL(raw);
    return (url.hostname || '').toLowerCase();
  }catch{
    const value = String(raw).toLowerCase().trim();
    return value.replace(/^https?:\/\//, '').split('/')[0];
  }
}

function classifySource(host){
  if (!host) return 'direct';
  if (host.includes('tiktok')) return 'tiktok';
  if (host.includes('youtube') || host.includes('youtu.be')) return 'youtube';
  if (host.includes('instagram')) return 'instagram';
  if (host.includes('facebook')) return 'facebook';
  if (host.includes('x.com') || host.includes('twitter')) return 'twitter';
  if (host.includes('google')) return 'google';
  if (host.includes('bing')) return 'bing';
  if (host.includes('discord')) return 'discord';
  return 'other';
}

function getConfiguredPublicHosts(){
  const list = String(process.env.PUBLIC_SITE_HOSTS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(list);
}

function isInternalHost(refHost, currentHost, configuredHosts){
  if (!refHost) return false;
  if (currentHost && refHost === currentHost) return true;
  if (configuredHosts.has(refHost)) return true;

  // Ignore Netlify preview/branch subdomains in reports
  if (refHost.endsWith('.netlify.app')) return true;

  // Handle common custom-domain variants
  if (refHost === 'art.outrage.ink' || refHost === 'www.art.outrage.ink') return true;

  return false;
}

async function loadStats(store){
  const current = await store.get(STATS_KEY, { type: 'json' });
  const safe = toObject(current);
  safe.totalVisits = toInt(safe.totalVisits);
  safe.uniqueVisitors = toInt(safe.uniqueVisitors);
  safe.byCountry = toObject(safe.byCountry);
  safe.bySource = toObject(safe.bySource);
  safe.byReferrerHost = toObject(safe.byReferrerHost);
  safe.daily = toObject(safe.daily);
  return safe;
}

exports.handler = async function handler(event){
  try{
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    connectLambda(event);
    const store = getStore(STORE_NAME);
    const payload = event.body ? JSON.parse(event.body) : {};
    const visitorId = normalizeVisitorId(payload.visitorId);
    if (!visitorId) return json(400, { error: 'Missing or invalid visitorId' });

    const headers = Object.fromEntries(
      Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
    );
    const configuredHosts = getConfiguredPublicHosts();
    const day = getAthensDateKey();
    const country = getCountryFromHeaders(headers);
    const currentHost = normalizeHost(
      payload.host || headers['x-forwarded-host'] || headers.host || ''
    );
    const referrer = payload.referrer || headers.referer || '';
    const refHost = normalizeHost(referrer);
    const internalRef = isInternalHost(refHost, currentHost, configuredHosts);
    const source = internalRef ? 'direct' : classifySource(refHost);
    const visitorHash = hash(visitorId);

    const globalSeenKey = `seen:visitor:${visitorHash}`;
    const dailySeenKey = `seen:day:${day}:${visitorHash}`;

    const [seenGlobal, seenDaily] = await Promise.all([
      store.get(globalSeenKey, { type: 'text' }),
      store.get(dailySeenKey, { type: 'text' })
    ]);

    const stats = await loadStats(store);
    stats.totalVisits += 1;
    incMap(stats.byCountry, country);
    incMap(stats.bySource, source);
    if (refHost && !internalRef) incMap(stats.byReferrerHost, refHost);

    const dayStats = toObject(stats.daily[day]);
    dayStats.visits = toInt(dayStats.visits) + 1;
    dayStats.uniqueVisitors = toInt(dayStats.uniqueVisitors);

    if (!seenGlobal){
      stats.uniqueVisitors += 1;
      await store.set(globalSeenKey, '1');
    }
    if (!seenDaily){
      dayStats.uniqueVisitors += 1;
      await store.set(dailySeenKey, '1');
    }
    stats.daily[day] = dayStats;

    await store.setJSON(STATS_KEY, stats);

    return json(200, {
      ok: true,
      countedVisit: true,
      source,
      country,
      totals: {
        totalVisits: stats.totalVisits,
        uniqueVisitors: stats.uniqueVisitors
      }
    });
  }catch (err){
    return json(500, { error: 'Server error', detail: String(err && err.message || err) });
  }
};
