# mycv4u.com source

The site is one static page, `site/index.html`, assembled from the parts in `source/parts`:

| Part | What it holds |
|---|---|
| `head.html` | `<head>`, fonts, the whole stylesheet |
| `header.html` | icons and the top bar |
| `home.html` | the overview, in landing order: first screen (what this is, one call button, results so far), what gets fixed, how a first day goes, six jobs, client pages, builder, owners, map, workshop, experience, about, common questions, contact |
| `pages.html` | one page per business, the renders page, footer |
| `manifest.js` | every picture with its caption and group |
| `app.js` | behaviour: job switcher, galleries, picture viewer, forms, routing |
| `hero3d.js` | the sample kitchen inside the kitchen job: it loads when the job comes near and draws itself once it is on screen |

Build: `node source/build.js` writes `site/index.html`.

Look: every colour is a token in the `:root` block at the top of `head.html` (plum page, pink cards, tomato bands, amber lines). One typeface, Geist, self-hosted in `site/assets/fonts`; the type scale is the `--t-*` tokens in the same block.

Checks: `node source/tools/smoke.js` opens the built site in a browser on desktop and phone and runs about 130 behaviour checks. `node source/tools/card.js` redraws the link preview picture from `source/tools/card.html`.

Settings that change in one line are at the top of `app.js`: `PORTRAIT` (a photo), `GOOGLE_REVIEW` (the review link of the Google Business Profile).

Client names, addresses and prices are hidden in every picture. Video clips are added only with each business owner's OK.
