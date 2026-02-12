const crypto = require('crypto');
const COOKIE_NAME = 'oa_admin';

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

function buildCookie(token){
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax`;
}

exports.handler = async function handler(event){
  try{
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const adminPassword = process.env.ADMIN_DASH_PASSWORD;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET;
    if (!adminPassword || !sessionSecret){
      return json(500, { error: 'Missing admin env vars' });
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const password = String(body.password || '');
    if (!password || password !== adminPassword){
      return json(401, { error: 'Invalid credentials' });
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + (60 * 60 * 8); // 8h
    const token = sign({ role: 'admin', iat: now, exp }, sessionSecret);

    return json(200, { ok: true, exp }, { 'Set-Cookie': buildCookie(token) });
  }catch (err){
    return json(500, { error: 'Server error', detail: String(err && err.message || err) });
  }
};
