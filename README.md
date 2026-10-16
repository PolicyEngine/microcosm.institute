# microcosm.institute

Landing site for **microcosm** — an open-source stack for building weighted
synthetic populations from survey and administrative data.

- The stack: https://github.com/PolicyEngine/microcosm
- The site: static HTML pages (`index.html` + `style.css` + `field.js`),
  no build step.

## UK methodology

The UK pipeline methodology lives at `/methodology/uk`, with canonical page
source in [`methodology/uk/index.html`](methodology/uk/index.html). It starts as
a draft pending editorial and technical review. Follow
[`methodology/EDITING.md`](methodology/EDITING.md) for focused updates,
source references, release scope and publication review.

## Develop

```bash
python3 -m http.server 4399
# open http://localhost:4399
```

## Design

Typography: Fraunces (display) · Newsreader (body) · IBM Plex Mono (labels).
The hero canvas (`field.js`) renders one point of light per synthetic household,
brightness scaled by survey weight. Respects `prefers-reduced-motion`.

Deployed to Vercel; static, no framework.
