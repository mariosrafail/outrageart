const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function trimSlash(value){
  return String(value || '').replace(/\/+$/g, '');
}

function deriveCompactFromLegacy(items){
  function parseUrlParts(url){
    const m = String(url || '').match(/^(.*)\/([^/]+)\/([^/]+)$/);
    if (!m) return null;
    return { base: m[1], slug: m[2], file: m[3] };
  }

  function parseThumbParts(url){
    const m = String(url || '').match(/^(.*)\/([^/]+)$/);
    if (!m) return null;
    return { base: m[1], file: m[2] };
  }

  const firstUrl = parseUrlParts(items[0] && items[0].url);
  const firstThumb = parseThumbParts(items[0] && items[0].thumb);
  const artBaseUrl = firstUrl ? firstUrl.base : '';
  const thumbBaseUrl = firstThumb ? firstThumb.base : '';
  const artDefaultFile = (firstUrl && firstUrl.file) ? firstUrl.file : '1.png';

  const compactItems = items.map((it) => {
    const u = parseUrlParts(it.url);
    const t = parseThumbParts(it.thumb);
    const slug = u ? u.slug : String(it.slug || '').trim();
    const out = {
      id: it.id,
      title: it.title,
      theme: it.theme,
      gender: it.gender,
      difficulty: it.difficulty,
      slug
    };
    if (!u || u.base !== artBaseUrl || u.file !== artDefaultFile) out.url = it.url;
    if (!t || t.base !== thumbBaseUrl || t.file !== `${slug}.png`) out.thumb = it.thumb;
    if (it.shop) out.shop = it.shop;
    if (Array.isArray(it.tags) && it.tags.length) out.tags = it.tags;
    return out;
  });

  return {
    schemaVersion: 2,
    media: {
      artBaseUrl,
      thumbBaseUrl,
      artDefaultFile,
      thumbFilePattern: '{slug}.png'
    },
    items: compactItems
  };
}

function normalizePayload(payload){
  if (Array.isArray(payload)) return deriveCompactFromLegacy(payload);
  if (!payload || typeof payload !== 'object') throw new Error('items payload must be object or array');
  if (!Array.isArray(payload.items)) throw new Error('items payload missing items[]');
  if (!payload.media || typeof payload.media !== 'object') throw new Error('items payload missing media');
  return payload;
}

async function main(){
  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl){
    throw new Error('Missing NEON_DATABASE_URL or DATABASE_URL');
  }

  const schemaSql = fs.readFileSync(path.join(process.cwd(), 'db/schema.sql'), 'utf8');
  const rawPayload = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/items.json'), 'utf8'));
  const payload = normalizePayload(rawPayload);

  const artBaseUrl = trimSlash(payload.media.artBaseUrl);
  const thumbBaseUrl = trimSlash(payload.media.thumbBaseUrl);
  const artDefaultFile = String(payload.media.artDefaultFile || '1.png');
  const thumbFilePattern = String(payload.media.thumbFilePattern || '{slug}.png');

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try{
    await client.query('BEGIN');
    await client.query(schemaSql);

    await client.query(
      `INSERT INTO media_config (id, art_base_url, thumb_base_url, art_default_file, thumb_file_pattern, updated_at)
       VALUES (1, $1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         art_base_url = EXCLUDED.art_base_url,
         thumb_base_url = EXCLUDED.thumb_base_url,
         art_default_file = EXCLUDED.art_default_file,
         thumb_file_pattern = EXCLUDED.thumb_file_pattern,
         updated_at = NOW()`,
      [artBaseUrl, thumbBaseUrl, artDefaultFile, thumbFilePattern]
    );

    const incomingIds = new Set();
    for (const it of payload.items){
      const slug = String(it.slug || '').trim();
      if (!slug) throw new Error(`Item ${it.id} is missing slug`);
      const id = Number(it.id);
      if (!Number.isInteger(id)) throw new Error(`Item has invalid id: ${it.id}`);
      if (incomingIds.has(id)) throw new Error(`Duplicate item id in payload: ${id}`);
      incomingIds.add(id);

      const defaultUrl = `${artBaseUrl}/${slug}/${artDefaultFile}`;
      const defaultThumb = `${thumbBaseUrl}/${slug}.png`;
      const urlOverride = (it.url && String(it.url).trim() && String(it.url).trim() !== defaultUrl)
        ? String(it.url).trim()
        : null;
      const thumbOverride = (it.thumb && String(it.thumb).trim() && String(it.thumb).trim() !== defaultThumb)
        ? String(it.thumb).trim()
        : null;
      const shop = (it.shop && String(it.shop).trim()) ? String(it.shop).trim() : null;

      await client.query(
        `INSERT INTO items (
           id, title, theme, gender, difficulty, slug, url_override, thumb_override, shop, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           theme = EXCLUDED.theme,
           gender = EXCLUDED.gender,
           difficulty = EXCLUDED.difficulty,
           slug = EXCLUDED.slug,
           url_override = EXCLUDED.url_override,
           thumb_override = EXCLUDED.thumb_override,
           shop = EXCLUDED.shop,
           updated_at = NOW()`,
        [
          id,
          String(it.title || ''),
          String(it.theme || ''),
          String(it.gender || ''),
          String(it.difficulty || ''),
          slug,
          urlOverride,
          thumbOverride,
          shop
        ]
      );

      await client.query('DELETE FROM item_tags WHERE item_id = $1', [id]);
      const tags = Array.isArray(it.tags) ? [...new Set(it.tags.map(v => String(v).trim()).filter(Boolean))] : [];
      for (const tag of tags){
        await client.query(
          'INSERT INTO item_tags (item_id, tag) VALUES ($1, $2) ON CONFLICT (item_id, tag) DO NOTHING',
          [id, tag]
        );
      }
    }

    const ids = [...incomingIds];
    if (ids.length){
      await client.query('DELETE FROM items WHERE id <> ALL($1::int[])', [ids]);
    }else{
      await client.query('DELETE FROM items');
    }

    await client.query('COMMIT');
    console.log(`Migration and seed completed. Upserted ${ids.length} items.`);
  }catch (err){
    await client.query('ROLLBACK');
    throw err;
  }finally{
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

