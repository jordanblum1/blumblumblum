# blumblumblum

Jordan’s small, hand-rolled corner of the internet: links, photos, projects, and music.

The site is intentionally framework-free. Serve the repository as static files; for local development:

```sh
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Tests

The Playwright suite covers the Easter eggs, native link icons and Lucky Links on desktop and mobile. It serves the site on port 4501 by itself.

```sh
npm install
npx playwright install chromium
npx playwright test
```

Run `EVIDENCE=1 npx playwright test` to save screenshots to `docs/egg-evidence/` (ignored by git).

## Link icon motion

The seven source SVGs live in `assets/motion/`. GitHub, Instagram, Strava, the photo icon, the wing and JRB retain their existing native geometry; only the toolbox artwork was regenerated with Higgsfield. The JRB uses the original WebP alpha as a self-contained SVG mask. Motion uses scoped CSS transforms/opacity and a small visibility-aware controller, with keyboard focus and static reduced motion. Links navigate immediately.

After editing an SVG, refresh the static inline copies:

```sh
python3 scripts/sync-motion-icons.py
python3 scripts/sync-motion-icons.py --check
```

Higgsfield toolbox source SHA-256: `bd7a00e8e4bd38d3a98789eaffb5f90f02b6e73047cbe8b4885040412c4830d9`. The adaptation preserves its paths, normalizes the viewBox and adds the lid/tool choreography. Earlier generated studies for the other icons are not used as replacement identities.

## Lucky Links

“Feeling lucky?” in the footer reveals a three-reel link picker beneath the BLUM logo. Click or drag its arm to choose one of the existing nine destinations; matching symbols reveal a normal destination link. Back or Escape restores the grid. Long-pressing the BLUM logo is a second entrance.

The picker clones the existing decorative artwork with unique mask/clip IDs, uses three bounded Web Animations, and clears its reels on exit. Reduced motion settles instantly; a preference change, resize or hidden tab safely finishes a current choice. It uses no storage, remote resources or new dependencies. Without JavaScript the original link grid remains usable.
