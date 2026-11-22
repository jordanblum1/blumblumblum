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
npm ci
npx playwright install chromium
npm run verify
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

“Feeling lucky?” in the footer gathers the nine native link symbols into a physical three-reel machine in the same space. Each reel shows three rows; its center row is the winning payline. Click, press or drag the round handle down to choose a destination. Only the selected link appears as text. The × control or Escape disperses the symbols back to the grid. Long-pressing the BLUM logo is a second entrance.

`js/lucky-machine.js` owns the closed/opening/idle/spinning/closing states and their bounded Web Animations. `js/lucky-artwork.js` clones trusted local art with unique mask/clip IDs. A preference change, resize or hidden tab safely settles the current transition. Reduced motion is immediate. Without JavaScript all original links remain available. The generated cabinet and references are documented in [DESIGN.md](DESIGN.md).

## Journey map and checks

| Journey | Entry and implementation | Success | Check |
| --- | --- | --- | --- |
| Follow a personal link | `.outpost-link`, `js/icon-motion.js`, `assets/motion/` | Original href navigates immediately; native gesture remains recognizable | `tests/icons.spec.mjs` |
| Choose a lucky destination | Footer clue / logo hold, `js/lucky-machine.js`, `css/lucky-machine.css` | Gather into 3×3 reels, vertical pull, center winner, real destination link | `tests/lucky-machine.spec.mjs` |
| Recover from interruption | Escape, ×, resize, reduced motion / hidden tab | Usable grid or settled result, restored focus, no orphan animations | `tests/lucky-machine.spec.mjs` |
| Discover existing Easter eggs | `js/site.js` | Logo, playlist and other interactions remain usable | `tests/eggs.spec.mjs` |

`npm run check` validates every browser script’s syntax and the canonical SVG copies. `npm test` runs the existing desktop/mobile browser journeys; `npm run verify` runs both. Keep command definitions in `package.json`. There are no new runtime dependencies or build step.

The deployment workflow stages only public HTML, manifests, favicons, `assets/`, `css/` and `js/`; docs, tests and agent instructions are excluded. Keep its existing release and credential boundaries. Instructions for future agents live in [AGENTS.md](AGENTS.md).
