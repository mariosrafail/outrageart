const { getDbPool } = require('./_lib/db');
const { requireAdminClaims } = require('./_lib/admin-auth');

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

function trim(value){
  return String(value || '').trim();
}

function parseTags(value){
  if (Array.isArray(value)){
    return [...new Set(value.map(v => trim(v)).filter(Boolean))];
  }
  return [];
}

function toInt(value){
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

async function readAll(pool){
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
         i.url_override,
         i.thumb_override,
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
    return {
      media: {
        artBaseUrl: '',
        thumbBaseUrl: '',
        artDefaultFile: '1.png',
        thumbFilePattern: '{slug}.png'
      },
      items: []
    };
  }

  const mediaRow = mediaRes.rows[0];
  const media = {
    artBaseUrl: trim(mediaRow.art_base_url),
    thumbBaseUrl: trim(mediaRow.thumb_base_url),
    artDefaultFile: trim(mediaRow.art_default_file) || '1.png',
    thumbFilePattern: trim(mediaRow.thumb_file_pattern) || '{slug}.png'
  };

  const items = itemsRes.rows.map((r) => {
    const slug = trim(r.slug);
    const defaultUrl = `${media.artBaseUrl}/${slug}/${media.artDefaultFile}`;
    const defaultThumb = `${media.thumbBaseUrl}/${slug}.png`;
    return {
      id: Number(r.id),
      title: trim(r.title),
      theme: trim(r.theme),
      gender: trim(r.gender),
      difficulty: trim(r.difficulty),
      slug,
      url: trim(r.url_override) || defaultUrl,
      thumb: trim(r.thumb_override) || defaultThumb,
      urlOverride: trim(r.url_override),
      thumbOverride: trim(r.thumb_override),
      shop: trim(r.shop),
      tags: parseTags(r.tags)
    };
  });

  return { media, items };
}

exports.handler = async function handler(event){
  try{
    if (event.httpMethod === 'OPTIONS') return json(204, {});

    const sessionSecret = process.env.ADMIN_SESSION_SECRET;
    const claims = requireAdminClaims(event, sessionSecret);
    if (!claims) return json(401, { error: 'Unauthorized' });

    const pool = getDbPool();

    if (event.httpMethod === 'GET'){
      const data = await readAll(pool);
      return json(200, data);
    }

    const body = event.body ? JSON.parse(event.body) : {};

    if (event.httpMethod === 'POST'){
      const id = toInt(body.id);
      const title = trim(body.title);
      const theme = trim(body.theme);
      const gender = trim(body.gender);
      const difficulty = trim(body.difficulty);
      const slug = trim(body.slug);
      const urlOverride = trim(body.urlOverride || body.url) || null;
      const thumbOverride = trim(body.thumbOverride || body.thumb) || null;
      const shop = trim(body.shop) || null;
      const tags = parseTags(body.tags);

      if (!id || !title || !theme || !gender || !difficulty || !slug){
        return json(400, { error: 'Missing required fields' });
      }

      try{
        await pool.query('BEGIN');
        await pool.query(
          `INSERT INTO items (
            id, title, theme, gender, difficulty, slug, url_override, thumb_override, shop, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
          [id, title, theme, gender, difficulty, slug, urlOverride, thumbOverride, shop]
        );
        for (const tag of tags){
          await pool.query(
            'INSERT INTO item_tags (item_id, tag) VALUES ($1, $2) ON CONFLICT (item_id, tag) DO NOTHING',
            [id, tag]
          );
        }
        await pool.query('COMMIT');
      }catch (err){
        await pool.query('ROLLBACK');
        if (String(err && err.code) === '23505'){
          return json(409, { error: 'Duplicate id or slug' });
        }
        throw err;
      }

      return json(200, { ok: true });
    }

    if (event.httpMethod === 'PUT'){
      const id = toInt(body.id);
      const title = trim(body.title);
      const theme = trim(body.theme);
      const gender = trim(body.gender);
      const difficulty = trim(body.difficulty);
      const slug = trim(body.slug);
      const urlOverride = trim(body.urlOverride || body.url) || null;
      const thumbOverride = trim(body.thumbOverride || body.thumb) || null;
      const shop = trim(body.shop) || null;
      const tags = parseTags(body.tags);

      if (!id || !title || !theme || !gender || !difficulty || !slug){
        return json(400, { error: 'Missing required fields' });
      }

      try{
        await pool.query('BEGIN');
        const updated = await pool.query(
          `UPDATE items
           SET title=$2, theme=$3, gender=$4, difficulty=$5, slug=$6,
               url_override=$7, thumb_override=$8, shop=$9, updated_at=NOW()
           WHERE id=$1`,
          [id, title, theme, gender, difficulty, slug, urlOverride, thumbOverride, shop]
        );
        if (!updated.rowCount){
          await pool.query('ROLLBACK');
          return json(404, { error: 'Item not found' });
        }
        await pool.query('DELETE FROM item_tags WHERE item_id=$1', [id]);
        for (const tag of tags){
          await pool.query(
            'INSERT INTO item_tags (item_id, tag) VALUES ($1, $2) ON CONFLICT (item_id, tag) DO NOTHING',
            [id, tag]
          );
        }
        await pool.query('COMMIT');
      }catch (err){
        await pool.query('ROLLBACK');
        if (String(err && err.code) === '23505'){
          return json(409, { error: 'Duplicate slug' });
        }
        throw err;
      }

      return json(200, { ok: true });
    }

    if (event.httpMethod === 'DELETE'){
      const id = toInt(body.id);
      if (!id) return json(400, { error: 'Missing id' });

      const deleted = await pool.query('DELETE FROM items WHERE id=$1', [id]);
      if (!deleted.rowCount) return json(404, { error: 'Item not found' });
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  }catch (err){
    return json(500, { error: 'Server error', detail: String(err && err.message || err) });
  }
};

