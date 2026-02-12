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

exports.handler = async function handler(event){
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const clearCookie = 'oa_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
  return json(200, { ok: true }, { 'Set-Cookie': clearCookie });
};
