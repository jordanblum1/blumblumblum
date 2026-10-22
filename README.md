# blumblumblum

Jordan’s small, hand-rolled corner of the internet: links, photos, projects, and music.

The site is intentionally framework-free. Serve the repository as static files; for local development:

```sh
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Tests

The easter eggs have one Playwright spec, `tests/eggs.spec.mjs`. It serves the site on port 4501 by itself.

```sh
npm install
npx playwright install chromium
npx playwright test
```

Run `EVIDENCE=1 npx playwright test` to save screenshots to `docs/egg-evidence/` (ignored by git).
