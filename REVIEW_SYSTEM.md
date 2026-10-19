# Customer reviews

This extends the existing `stackendboxclients/Dubai-Car-recovery-site` Vercel project. It preserves the upper animated carousel design, styles and two-second timing. The compact form below contains name, 1–5 star rating, comment and Submit. The WhatsApp review button, separate review list, extra introduction, service and email fields are removed as requested. Approved real submissions join the existing example cards in the same carousel; none of the original cards, text or animations are removed. The existing 4.5 display is identified as illustrative and never used as a genuine customer aggregate. Original example card markup, global CSS and all JavaScript outside the carousel block are checked against baseline hashes.

## Storage and workflow

The implementation uses **private Vercel Blob storage**, not Supabase or a SQL database. This keeps the feature within the requested GitHub and Vercel services. Records persist independently of deployments. It is intended for the review volume of a local service business; it is not a general-purpose relational database.

Each review has its own JSON record containing `id`, `customer_name`, `rating`, `review_text`, optional `service` and `email`, `status`, `created_at`, `moderated_at`, and `moderated_by`. Status is `pending`, `approved`, `rejected` or `removed`.

1. A customer submits from the homepage. Server validation, a hidden honeypot, a short-lived signed form challenge and a persistent five-attempts-per-hour IP limit run before saving.
2. The server confirms the saved private record before returning success. Retrying the same submission UUID cannot create a second review or reset moderation.
3. An administrator opens `https://www.dubaicarrecovery.site/api/admin-reviews`, signs in using username `admin` and the separately supplied access key, and selects Pending.
4. Approve makes genuine feedback eligible for publication, including one-star feedback. Reject marks spam or abuse. Remove hides a review and can be reversed. A removed review is retained privately; permanent deletion can be performed by the account owner in private Vercel storage for a deletion request.
5. Only approved records are projected to the public API. Email, status, moderation fields and storage URLs are never returned publicly.

The dashboard uses HTTPS HTTP Basic authentication with a random 256-bit access key. Only its SHA-256 hash is configured on the server; comparison is constant-time. Browsers may cache HTTP authentication until closed. Do not use a shared browser. There is also an authenticated terminal tool: `node scripts/moderate-reviews.mjs list`, `approve ID`, `reject ID`, `remove ID` or `pending ID`. It prompts for the key without echoing it.

## Endpoints and security

- `GET /api/review-config`: signed, IP-bound challenge and optional public Turnstile site key. Never sends private configuration.
- `GET /api/reviews`: six discovery markers per page, opaque cursor pagination, latest canonical status rechecked before publication.
- `POST /api/reviews`: bounded JSON request; validated name, integer rating 1–5, 10–3,000 character review, actual service allowlist and optional email. Plain text is rendered using `textContent`, never HTML.
- `GET/PATCH/DELETE /api/admin-reviews`: authenticated dashboard/list and moderation. Browser writes also require the allowed Origin and JSON content type. CLI writes require an explicit Bearer key.
- `GET /api/review-cleanup`: authenticated Vercel cron, daily at 03:00 UTC, removes expired rate records older than a day. Cleanup is bounded to 1,000 keys per run and never deletes review records.

All storage reads/writes require server credentials. Uncached private reads and ETag conditional updates prevent stale moderation and lost concurrent rate-limit updates. Public markers contain identifiers only, never email or review content. Public cards always re-read the canonical record, so an old publication marker cannot expose a removed review. Submitted and publication storage indexes are separate; the displayed approved records feed the existing carousel. Index operations can fail independently of record writes; a failed submission keeps the form contents and a retry repairs the submitted marker.

All API responses use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Admin HTML has a restrictive CSP and is excluded from indexing. No fabricated reviews, review aggregate or review structured data are added.

Optional Cloudflare Turnstile is implemented but not enabled unless both site and secret keys are configured. The server checks token success, hostname and action. No Cloudflare account was connected for this implementation.

## Configuration

`BLOB_READ_WRITE_TOKEN` is provisioned by the existing Vercel project's private store. `REVIEW_SIGNING_SECRET`, `REVIEW_ADMIN_TOKEN_HASH` and `CRON_SECRET` are sensitive server variables. `REVIEW_ALLOWED_ORIGINS` contains only the two real website origins. The current Vercel preview hostname is added only in Preview deployments.

Production uses `customer-reviews-v1/`; Preview uses `customer-reviews-preview-v1/`. Local QA requires its own `local-test-.../` namespace. Never run destructive QA against production records. Never commit `.env.local` or the admin credentials file.

Rotate the administrator key by generating a fresh random 32-byte key, replacing `REVIEW_ADMIN_TOKEN_HASH` with its SHA-256 hash in Vercel, and deploying. The raw access key belongs only in the owner's password manager.

## Files and build

The existing ZIP-based build restores the original verified site, then `scripts/build-reviews.mjs` inserts the compact `reviews/client/section.html` immediately after the animated reviews, removes the review WhatsApp button and wires the carousel to approved submissions. It copies separate customer/admin scripts and styles and adds a review privacy disclosure. It regenerates changed gzip files and re-runs the original 43-page static checks. Existing SEO metadata and other site sections stay unchanged.

Modified configuration: `build-production.mjs`, `package.json`, `package-lock.json`, `vercel.json`. Added feature code: `api/*.js`, `reviews/client/*`, `reviews/server/*`. Supporting files: `.env.example`, `.gitignore`, `scripts/build-reviews.mjs`, `scripts/moderate-reviews.mjs`, local/live QA scripts and `tests/*`.

Verification commands: `npm ci`, `npm run build`, `npm run check`, `npm test`, `npm audit --omit=dev`. Real private-storage verification uses `node --env-file=.env.local scripts/live-storage-test.mjs` with an isolated namespace; test records are explicitly labelled and removed afterwards. It must never populate the production publication index.
