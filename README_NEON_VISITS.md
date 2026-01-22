# Neon visit tracking for this Netlify site

This project adds:
- /api/visit  (POST) records a unique daily visit per visitor per page
- /api/stats  (GET) returns totals and a 14-day trend

## 1) Create the table in Neon (SQL Editor)

Run this SQL:

CREATE TABLE IF NOT EXISTS page_visits (
  id BIGSERIAL PRIMARY KEY,
  page TEXT NOT NULL,
  visit_date DATE NOT NULL,
  visitor_hash TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensures 1 visit per visitor per page per day
CREATE UNIQUE INDEX IF NOT EXISTS page_visits_unique_daily
ON page_visits (page, visit_date, visitor_hash);

-- Useful index for reports
CREATE INDEX IF NOT EXISTS page_visits_by_date
ON page_visits (visit_date);

## 2) Where you put the Neon "link" (connection string)

On Netlify:
Site configuration -> Environment variables

Add:
- DATABASE_URL = <Neon connection string>
- VISIT_SALT   = <any random string, optional but recommended>

Notes:
- In Neon, copy the pooled connection string (recommended for serverless).
- Keep DATABASE_URL secret, never put it in frontend code.

## 3) Deploy on Netlify

- Upload this folder/zip to Netlify (or connect repo)
- Build command: leave empty
- Publish directory: "." (already set in netlify.toml)
- Netlify will run `npm install` to install pg for functions

## 4) Test

Open your site, then visit:
- /.netlify/functions/stats
or
- /api/stats

For a specific page:
- /api/stats?page=/index.html
or whatever location.pathname returns on your site.
