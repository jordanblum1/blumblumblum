# Working in this repo

This is a framework-free static personal site. Start with the journey map in [README.md](README.md) and the existing code for the affected interaction. Shared visual decisions live in [DESIGN.md](DESIGN.md).

- Preserve the nine original link destinations, accessible names and immediate normal navigation. Lucky Links chooses a destination; it never navigates automatically.
- Edit native motion artwork in `assets/motion/`, then use the sync command documented in README. The inline copies are checked mechanically.
- Use the package scripts as the command source: `check` for syntax/source consistency, `test` for the browser journeys, `verify` for both. Keep meaningful regression checks with the behavior; do not add a framework or lint stack for a small change.
- Animate transforms/opacity directly on the moving element. Keep normal motion running; add pause controls only when Jordan requests them. Honor reduced motion and hidden-tab/offscreen suspension.
- For visual changes, verify desktop, mobile, keyboard, interruption/recovery and console errors. Use the site’s existing palette and native logo geometry.
- Keep credentials outside public assets. Preserve the workflow’s runner, secret and release boundaries. A separately authorized one-off hosted deployment is not a permanent runner-policy change.
- Before merging meaningful changes, use the installed `auto-review` skill with independent structure, correctness and security verdicts. Follow existing release authorization.

These local rules apply Jordan’s [Agent Playbook](https://github.com/jordanblum1/agent-playbook), reviewed at `13f2864b646760b55ff5c0c40a09d512e17762fd`: agent-friendly repos, anti-slop code, Frontend Design Director and Unslop. Keep project checks here and reusable judgment in the playbook.
