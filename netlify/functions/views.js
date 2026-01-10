const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

// DATABASE_URL must be set in Netlify environment variables.
const sql = neon(process.env.DATABASE_URL);

function pickId(searchParams) {
  return (
    searchParams.get('id') ||
    searchParams.get('imageId') ||
    searchParams.get('itemId') ||
    ''
  ).trim();
}

function header(event, name) {
  const h = event.headers || {};
  // Netlify lowercases headers in functions
  return (h[name.toLowerCase()] || h[name] || '').toString();
}

function getClientIp(event) {
  // Netlify-specific header first, then standard XFF
  const nf = header(event, 'x-nf-client-connection-ip').trim();
  if (nf) return nf;

  const xff = header(event, 'x-forwarded-for').trim();
  if (xff) return xff.split(',')[0].trim();

  return '';
}

function getClientId(event) {
  // Sent by frontend as a non-strict fallback when IP isn't available
  return header(event, 'x-client-id').trim();
}

function hashIdentity(value) {
  const salt = (process.env.VIEWS_SALT || 'change-me').toString();
  return crypto.createHash('sha256').update(`${value}|${salt}`).digest('hex');
}

async function ensureTables() {
  // Lightweight safety: creates tables if missing.
  // Keeps setup simple even if you didn't run the SQL manually.
  await sql`
    create table if not exists image_views (
      id text primary key,
      views bigint not null default 0
    );
  `;
  await sql`
    create table if not exists image_view_ips (
      id text not null,
      ip_hash text not null,
      first_seen timestamptz not null default now(),
      primary key (id, ip_hash)
    );
  `;
}

exports.handler = async (event) => {
  try {
    const u = new URL(event.rawUrl);
    const id = pickId(u.searchParams);

    if (!id) {
      return {
        statusCode: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ error: 'Missing id' })
      };
    }

    // Ensure schema exists (no-op after first run)
    await ensureTables();

    const ip = getClientIp(event);
    const clientId = getClientId(event);
    const identity = ip || clientId;

    // If we can't identify, just return current count without increment.
    if (!identity) {
      const rows = await sql`select views from image_views where id=${id}`;
      const views = rows[0]?.views ?? 0;
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ id, views })
      };
    }

    const ipHash = hashIdentity(identity);

    // Transaction: create row if missing, insert ipHash once, increment once.
    const views = await sql.transaction(async (tx) => {
      await tx`insert into image_views (id, views) values (${id}, 0)
              on conflict (id) do nothing`;

      const inserted = await tx`
        insert into image_view_ips (id, ip_hash)
        values (${id}, ${ipHash})
        on conflict do nothing
        returning 1 as ok
      `;

      if (inserted.length) {
        await tx`update image_views set views = views + 1 where id=${id}`;
      }

      const r = await tx`select views from image_views where id=${id}`;
      return r[0]?.views ?? 0;
    });

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      },
      body: JSON.stringify({ id, views })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};
