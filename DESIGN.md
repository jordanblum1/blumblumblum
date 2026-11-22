# Visual contract

The existing site is the authority: a photo collage behind translucent warm paper, sculptural BLUM lettering, oxblood native icons and Switzer typography. Shared tokens live in `css/style.css`: paper `#f7f3ed`, raised paper `#fcfaf6`, ink `#2b2521`, oxblood `#9c4037`, and the existing darkroom palette. Reuse these before adding colors or surfaces.

Keep the original logo geometry and its small, individual motion gestures. Link discs stay steady while their artwork acts. The photo, GitHub, Instagram, Strava, wing and JRB marks retain their native identity; the toolbox is the deliberately regenerated exception.

Lucky Links is a physical object in the same world: cream enamel, oxblood side panels and restrained aged-brass hardware. It occupies the original links stage. The nine link symbols gather into three tall reels, with three visible rows and the winning row centered between the cabinet’s pointers. Reels decelerate and stop in sequence. The round plunger travels straight down through a brass sleeve mounted across the cabinet edge. The winning center row receives a quiet outline; a paper ticket with the chosen native icon and destination emerges from the payout tray. Text belongs only on that ticket; other controls use clear shapes with accessible names and hidden instructions.

Motion explains a change of state: gather, pull, roll, settle, disperse. Use transform/opacity, a bounded duration and explicit cancellation. Keep normal motion; do not add pause UI unless requested. Reduced motion settles immediately. Hidden tabs, resize and interrupted opening/closing must restore a usable state.

## Cabinet source

`assets/lucky-cabinet.webp` is a compressed version of the original Higgsfield PNG, job `fd29d4d4-287d-4605-8372-8c639cd9578b` (GPT Image 2.6, one image). It uses this site’s public OG image for style and mechanical construction references, with no logos or text baked into the reel windows. Symbols, lever and destination remain live HTML/SVG. Original PNG SHA-256: `a0d0bcd2f4bf87fffa0f3194bc7f4937858bf72168b43d0279fd68ea7c1c8e77`; shipped WebP SHA-256: `dde1a45d1965cdca75147edeb01ba2f6797f102299deb034c864aaa8e6c65470`.

Physical references found through Firecrawl: [1930 Mills restoration](https://www.youtube.com/watch?v=vOb0LvBeK98) and [Spicers mechanical three-reel machine](https://www.spicersauctioneers.com/catalogue/lot/3c99fdddb64ca92ad317375600706354/2a6fa85538c56e3991b429b74f737ad8/jewellery-silver-watches-clocks-antiques-and-arcadi-lot-505/). These informed the tall reel openings, center payline, hood and hardware; their photographs are not shipped in the site.


## Motion, sound and small discoveries

The rare game cycle deliberately lasts longer than ordinary UI: the three reels stop at 2.8, 3.18 and 3.6 seconds. Nine, eleven and thirteen rows travel through a smooth acceleration / steady-roll / longer-deceleration velocity profile. The profile is sampled once into compositor keyframes, rather than running JavaScript each frame. The release follows the pointer directly; its return uses an interruptible 200ms transition. The cabinet and collage stay steady. Ticket and payline arrive with the final stop (240/220ms); reduced motion settles directly.

Sound is local, quiet and initiated only by a deliberate lever action. Four small MP3s in `assets/audio/` supply a pull, a rolling bed, a stop and a winning bell. Audio loading, decoding or autoplay failure leaves the picker usable in silence. Actual reel completions trigger stop cues; closing, hidden tabs, reduced motion and interrupted rounds stop playback and invalidate pending starts. No API key or generation request runs in the browser.

Audio provenance: one five-second Higgsfield Seedance 2.5 draft, job `41747c81-d850-47fb-88ca-9ba438ba9dcb`, 15 credits. The soundtrack was extracted, trimmed, faded and level-limited into the four cues. The generated video is not a runtime dependency. [Web Audio guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) informed explicit user activation and short buffered samples.

Keep the glass treatment on the BLUM panel and icon discs. Link captions use 14px Switzer at weight 500 on small opaque paper strips, with 10px corners and no blur, glow or pill shape. Full names wrap when needed. Caption and signature colors are ink on raised paper in both themes (14.50:1 light, 14.40:1 darkroom); the collage cannot change that contrast. The footer stays transparent around a small paper signature, a miniature three-reel lucky machine and a film-frame grain hint. Both Easter eggs retain named native buttons, keyboard access and hover titles; no persistent extra copy or settings panel.


Contrast uses controlled surfaces rather than a text-shadow halo over photographs. The winner ticket keeps fixed oxblood ink on cream (8.39:1), and the physical reel symbols keep oxblood in both themes (6.04:1), independent of the darkroom accent. Dialog secondary and action text also meet 4.5:1 in each theme; focus outlines get an opaque paper surround. These are source-color calculations, with browser/compositing verification recorded separately. Reference: [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).


Responsive links: phones and touch tablets keep three equal columns (3×3 for the current nine destinations), including narrow phones and iPad landscape. Above 1024px on a fine-pointer/hover desktop, five equal-width links wrap into two centered rows (5+4). The wrapping layout handles a different link count without a hard-coded last-row offset. Captions can wrap full names. Paper-caption corners are 10px, the small signature is 8px, and the winner ticket has 6px top / 10px bottom corners; the logo panel and circular icon discs retain their established radii.
