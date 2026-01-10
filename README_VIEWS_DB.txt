VIEWS COUNTER (Netlify Function + Postgres)

1) Create tables
   Run the SQL in: netlify/sql/init.sql
   on your Neon/Netlify DB.

2) Netlify environment variables
   Set these in Netlify Site settings -> Environment variables:
   - DATABASE_URL  (your Postgres connection string)
   - VIEWS_SALT    (random string, any length)

3) Endpoint
   GET /.netlify/functions/views?id=<ITEM_ID>
   (also supports imageId/itemId)

4) Frontend
   On every Show, the site calls the endpoint.
   The endpoint increments only once per IP per item (fallback: once per browser if IP is not available).
