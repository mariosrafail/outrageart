const { Client } = require("pg");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
    };
  }

  const conn = process.env.DATABASE_URL;
  if (!conn) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Missing DATABASE_URL env var" }),
    };
  }

  const params = event.queryStringParameters || {};
  const page = params.page ? String(params.page).slice(0, 512) : null;

  const today = new Date().toISOString().slice(0, 10);

  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    // total unique daily visits (unique by page+date+visitor_hash)
    const totalQuery = page
      ? `SELECT COUNT(*)::int AS c FROM page_visits WHERE page = $1`
      : `SELECT COUNT(*)::int AS c FROM page_visits`;
    const totalRes = page
      ? await client.query(totalQuery, [page])
      : await client.query(totalQuery);

    const todayQuery = page
      ? `SELECT COUNT(*)::int AS c FROM page_visits WHERE page = $1 AND visit_date = $2`
      : `SELECT COUNT(*)::int AS c FROM page_visits WHERE visit_date = $1`;
    const todayRes = page
      ? await client.query(todayQuery, [page, today])
      : await client.query(todayQuery, [today]);

    // last 14 days trend
    const trendQuery = page
      ? `
        SELECT visit_date, COUNT(*)::int AS visits
        FROM page_visits
        WHERE page = $1 AND visit_date >= (CURRENT_DATE - INTERVAL '13 days')::date
        GROUP BY visit_date
        ORDER BY visit_date ASC
      `
      : `
        SELECT visit_date, COUNT(*)::int AS visits
        FROM page_visits
        WHERE visit_date >= (CURRENT_DATE - INTERVAL '13 days')::date
        GROUP BY visit_date
        ORDER BY visit_date ASC
      `;
    const trendRes = page
      ? await client.query(trendQuery, [page])
      : await client.query(trendQuery);

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: true,
        page: page || null,
        total: totalRes.rows[0].c,
        today: todayRes.rows[0].c,
        trend14: trendRes.rows,
      }),
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
