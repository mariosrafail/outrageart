const { Client } = require("pg");
const crypto = require("crypto");

function getClientIp(headers) {
  // Netlify provides this header on edge
  const nfIp = headers["x-nf-client-connection-ip"];
  if (nfIp) return nfIp;

  const xff = headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();

  return "0.0.0.0";
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
    };
  }

  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
  );

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch (_) {
    payload = {};
  }

  const page = (payload.page || "/").toString().slice(0, 512);
  const referrer = (payload.referrer || "").toString().slice(0, 1024);

  const ip = getClientIp(headers);
  const ua = (headers["user-agent"] || "").toString().slice(0, 512);

  const salt = process.env.VISIT_SALT || "";
  const visitor_hash = sha256(`${ip}|${ua}|${salt}`);

  const visit_date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const conn = process.env.DATABASE_URL;
  if (!conn) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Missing DATABASE_URL env var" }),
    };
  }

  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    const q = `
      INSERT INTO page_visits (page, visit_date, visitor_hash, referrer, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (page, visit_date, visitor_hash) DO NOTHING
    `;
    const result = await client.query(q, [page, visit_date, visitor_hash, referrer, ua]);

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, counted: result.rowCount === 1 }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }),
    };
  } finally {
    try { await client.end(); } catch (_) {}
  }
};
