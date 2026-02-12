const crypto = require('crypto');

const COOKIE_NAME = 'oa_admin';

function fromBase64url(input){
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
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

function requireAdminClaims(event, sessionSecret){
  if (!sessionSecret) return null;
  const cookies = parseCookies(event.headers && (event.headers.cookie || event.headers.Cookie));
  const token = cookies[COOKIE_NAME] || '';
  return verifyToken(token, sessionSecret);
}

module.exports = { requireAdminClaims };

