# DubaiCarRecovery.site

Complete production website and source for https://www.dubaicarrecovery.site/.

## Repository contents

`website-source.zip` contains the published `source/` code, editable blog text, artwork, production `dist/` and static verification script. Extract it locally to edit source. The bundle includes 13 distinct service pages, the homepage and supporting pages, and the blog articles listed in `source/blogs/metadata.json`. Unpublished article drafts are excluded from the archive. Recovery illustrations are packaged once under `dist/media/recovery/` and restored to `source/assets/recovery/` during extraction. SEO audit and implementation notes are in `docs/seo/`.

`build-production.mjs` verifies the archive SHA-256, extracts it using built-in Node modules, then verifies all production pages and assets. No external packages, secrets or Python runtime are required for the Vercel build.

`vercel.json` selects the `dist/` output directory, trailing-slash routing and static asset caching. Vercel's Git integration deploys pushes to main.

To edit: run `node build-production.mjs` to extract the verified bundle; change the source; regenerate production dist with Python; rerun static verification; then run `python3 scripts/package-production.py` to rebuild the archive and checksum before committing. Production canonical host: https://www.dubaicarrecovery.site/.

Booking is a WhatsApp enquiry, followed by team confirmation. No automated reservation or confirmed dispatch is claimed.
