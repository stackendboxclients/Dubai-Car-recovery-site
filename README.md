# DubaiCarRecovery.site

Complete production website and source for https://www.dubaicarrecovery.site/.

## Repository contents

`website-source.zip` contains the full `source/` code, editable blog text, source artwork, assets, production `dist/` and static verification script. Extract it locally to edit source. The bundle preserves directory paths for all 24 pages and both 5,000-word articles.

`build-production.mjs` verifies the archive SHA-256, extracts it using built-in Node modules, then verifies all production pages and assets. No external packages, secrets or Python runtime are required for the Vercel build.

`vercel.json` selects the `dist/` output directory, trailing-slash routing and static asset caching. Vercel's Git integration deploys pushes to main.

To edit: unzip website-source.zip; change source; regenerate production dist with Python; rerun static verification; rebuild the archive and update the checksum in build-production.mjs before committing. Production canonical host: https://www.dubaicarrecovery.site/.

Booking is a WhatsApp enquiry, followed by team confirmation. No automated reservation or confirmed dispatch is claimed.
