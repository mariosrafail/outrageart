const crypto = require('crypto');
const { connectLambda, getStore } = require('@netlify/blobs');
const COOKIE_NAME = 'oa_admin';
const STORE_NAME = 'site-analytics';
const RATE_KEY_PREFIX = 'admin-login:ratelimit:ip:';
const RATE_WINDOW_SEC = 10 * 60; // 10m
const RATE_MAX_ATTEMPTS = 5;
const RATE_BLOCK_SEC = 15 * 60; // 15m

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

function base64url(input){
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sign(payload, secret){
  const data = base64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${data}.${sig}`;
}

function safeEqual(a, b){
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

function buildCookie(token, secure = true){
  const secureAttr = secure ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=28800; HttpOnly${secureAttr}; SameSite=Lax`;
}

function normalizeHeaders(headers){
  return Object.fromEntries(
    Object.entries(headers || {}).map(([k, v]) => [String(k).toLowerCase(), String(v || '')])
  );
}

function sha256(input){
  return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

function getClientIp(headers){
  const forwarded = String(headers['x-forwarded-for'] || '').trim();
  if (forwarded){
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return (
    String(headers['x-nf-client-connection-ip'] || '').trim() ||
    String(headers['client-ip'] || '').trim() ||
    'unknown'
  );
}

function sanitizeRateRecord(raw){
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const count = Number.isFinite(Number(src.count)) ? Math.max(0, Math.floor(Number(src.count))) : 0;
  const windowStart = Number.isFinite(Number(src.windowStart)) ? Math.floor(Number(src.windowStart)) : 0;
  const blockedUntil = Number.isFinite(Number(src.blockedUntil)) ? Math.floor(Number(src.blockedUntil)) : 0;
  return { count, windowStart, blockedUntil };
}

async function getRateStatus(store, ip, now){
  const key = `${RATE_KEY_PREFIX}${sha256(ip)}`;
  const record = sanitizeRateRecord(await store.get(key, { type: 'json' }));
  const blocked = record.blockedUntil > now;
  const retryAfterSec = blocked ? Math.max(1, record.blockedUntil - now) : 0;
  return { key, record, blocked, retryAfterSec };
}

async function registerFailedAttempt(store, key, record, now){
  let next;
  if (!record.windowStart || (now - record.windowStart) > RATE_WINDOW_SEC){
    next = { count: 1, windowStart: now, blockedUntil: 0 };
  }else{
    next = {
      count: record.count + 1,
      windowStart: record.windowStart,
      blockedUntil: record.blockedUntil
    };
  }

  if (next.count >= RATE_MAX_ATTEMPTS){
    next.blockedUntil = now + RATE_BLOCK_SEC;
    next.count = 0;
    next.windowStart = now;
  }

  await store.setJSON(key, next);
}

exports.handler = async function handler(event){
  try{
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const adminUsername = String(process.env.ADMIN_DASH_USERNAME || 'adminrage').trim();
    const adminPassword = process.env.ADMIN_DASH_PASSWORD;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET;
    if (!adminUsername || !adminPassword || !sessionSecret){
      return json(500, { error: 'Missing admin env vars' });
    }

    const headers = normalizeHeaders(event.headers);
    const clientIp = getClientIp(headers);
    const now = Math.floor(Date.now() / 1000);
    const forwardedProto = String(headers['x-forwarded-proto'] || '').toLowerCase();
    const requestHost = String(headers.host || headers['x-forwarded-host'] || '').toLowerCase();
    const isLocalHost = requestHost.includes('localhost') || requestHost.includes('127.0.0.1');
    const shouldUseSecureCookie = forwardedProto === 'https' || (!isLocalHost && !forwardedProto);

    let store = null;
    try{
      connectLambda(event);
      store = getStore(STORE_NAME);
    }catch{}

    // Fail-open on rate-limit storage errors to avoid locking out admins during infra issues.
    let rateState = null;
    if (store){
      try{
        rateState = await getRateStatus(store, clientIp, now);
        if (rateState.blocked){
          return json(
            429,
            { error: 'Too many login attempts. Try again later.' },
            { 'Retry-After': String(rateState.retryAfterSec) }
          );
        }
      }catch{}
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password || !safeEqual(username, adminUsername) || !safeEqual(password, adminPassword)){
      if (rateState){
        try{
          await registerFailedAttempt(store, rateState.key, rateState.record, now);
        }catch{}
      }
      return json(401, { error: 'Invalid credentials' });
    }

    if (rateState){
      try{
        await store.setJSON(rateState.key, { count: 0, windowStart: now, blockedUntil: 0 });
      }catch{}
    }

    const exp = now + (60 * 60 * 8); // 8h
    const token = sign({ role: 'admin', iat: now, exp }, sessionSecret);

    return json(200, { ok: true, exp }, { 'Set-Cookie': buildCookie(token, shouldUseSecureCookie) });
  }catch (err){
    return json(500, { error: 'Server error', detail: String(err && err.message || err) });
  }
};
