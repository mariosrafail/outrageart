const fs = require('fs');
const path = require('path');
const { getDbPool } = require('./_lib/db');

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

function loadLocalFallback(){
  const p = path.join(process.cwd(), 'data', 'items.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

exports.handler = async function handler(event){
  try{
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

    let pool;
    try{
      pool = getDbPool();
    }catch{
      return json(200, loadLocalFallback());
    }

    const [mediaRes, itemsRes] = await Promise.all([
      pool.query(
        `SELECT art_base_url, thumb_base_url, art_default_file, thumb_file_pattern
         FROM media_config
         WHERE id = 1`
      ),
      pool.query(
        `SELECT
           i.id,
           i.title,
           i.theme,
           i.gender,
           i.difficulty,
           i.slug,
           i.url_override AS url,
           i.thumb_override AS thumb,
           i.shop,
           COALESCE(
             ARRAY_AGG(t.tag ORDER BY t.tag) FILTER (WHERE t.tag IS NOT NULL),
             ARRAY[]::TEXT[]
           ) AS tags
         FROM items i
         LEFT JOIN item_tags t ON t.item_id = i.id
         GROUP BY i.id
         ORDER BY i.id`
      )
    ]);

    if (!mediaRes.rows.length){
      return json(200, loadLocalFallback());
    }

    const media = mediaRes.rows[0];
    const items = itemsRes.rows.map((r) => {
      const row = {
        id: Number(r.id),
        title: String(r.title || ''),
        theme: String(r.theme || ''),
        gender: String(r.gender || ''),
        difficulty: String(r.difficulty || ''),
        slug: String(r.slug || '')
      };
      if (r.url) row.url = String(r.url);
      if (r.thumb) row.thumb = String(r.thumb);
      if (r.shop) row.shop = String(r.shop);
      const tags = Array.isArray(r.tags) ? r.tags.map(v => String(v)).filter(Boolean) : [];
      if (tags.length) row.tags = tags;
      return row;
    });

    return json(200, {
      schemaVersion: 2,
      media: {
        artBaseUrl: String(media.art_base_url || ''),
        thumbBaseUrl: String(media.thumb_base_url || ''),
        artDefaultFile: String(media.art_default_file || '1.png'),
        thumbFilePattern: String(media.thumb_file_pattern || '{slug}.png')
      },
      items
    });
  }catch (err){
    return json(500, { error: 'Server error', detail: String(err && err.message || err) });
  }
};

