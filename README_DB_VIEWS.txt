SETUP (Netlify + Postgres views counter)

1) Add environment variables in Netlify (Site settings -> Environment variables):
   - DATABASE_URL  (your Neon/Netlify DB connection string)
   - VIEWS_SALT    (any random string, e.g. 32+ chars)

2) Deploy this folder to Netlify.

3) Test:
   - https://YOURDOMAIN/api/views?id=1
   - Open a tutorial with Show -> bottom right should display: views: X

Notes:
- 1 view per IP per image id. If IP is not available, falls back to 1 view per browser (x-client-id).
- You shared a DB URL with credentials in chat. Rotate that password/user if this is a real database.
