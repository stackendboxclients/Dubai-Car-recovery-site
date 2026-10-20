# Customer reviews

The compact Write a Review form sits below the original Customer Feedback carousel. Its name, 1–5 star and 10–3,000-character comment fields submit to the review API. Valid submissions are stored as published immediately, then inserted into the existing carousel without a reload. The original six cards, photos, text and two-second rotation remain and each carries a visible “Example review” label. Only genuine database records contribute to the displayed average and count.

## Storage

Use the existing Supabase PostgreSQL database connected to the Vercel project. Apply `reviews/migrations/001_customer_reviews.sql` once to the database before deployment. Vercel injects `POSTGRES_URL` into Production and Preview; `DATABASE_URL` is accepted as a local fallback. The Node.js API uses the pooled PostgreSQL connection with parameterized queries and a one-connection pool. Never place either URL in browser code or Git. Row level security is enabled without public policies, so the Supabase public API cannot read or write reviews directly. The existing private Vercel Blob store remains the shared persistent rate-limit store, and requires `BLOB_READ_WRITE_TOKEN`. The database holds the customer reviews and survives deployments.

The two old Blob records were submitted under a manual-approval policy; inspect them individually before deciding whether to import them. The migration intentionally does not silently publish pending or test records.

## API

- `GET /api/review-config`: signed, IP-bound form challenge and optional Turnstile site key.
- `POST /api/reviews`: validates origin, JSON size, name, all five ratings, text length, a hidden honeypot, signed challenge and optional Turnstile; saves a published record. Unique request IDs and submission hashes prevent duplicate records. A success response is sent only after the database confirms the save.
- `GET /api/reviews?cursor=...`: newest published genuine reviews, six per page, with an opaque keyset cursor and genuine average/count.
- `GET /api/review-stats`: genuine average and count.
- `GET /api/review-cleanup`: authenticated daily cleanup of expired rate-limit data.

The browser inserts review text with `textContent`. SQL is parameterized. Reviews with URLs, email addresses or likely phone numbers are rejected with a field error to avoid publishing private information or link spam. Negative feedback and low ratings are accepted. The existing five-attempts-per-hour IP limit, two-second signed form challenge and optional server-verified Cloudflare Turnstile remain. The legacy admin endpoint returns HTTP 410 and exposes no moderation controls. The old dashboard is no longer built or linked.

## Deployment checks

Run `npm ci`, `npm run check`, `npm run build`, `npm test`, and `npm audit --omit=dev`. Confirm `POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN`, `REVIEW_SIGNING_SECRET` and (for cron) `CRON_SECRET` exist in Vercel. Apply the SQL migration. Verify a genuine, clearly test-labelled review via a controlled production submission only when the owner is ready to leave a public test review; then verify GET and independent browser visibility. Do not claim production persistence merely from unit tests.
