# DizArch — single-page site

Interior design studio, specialists in colour and light. Bilingual (fa/en),
RTL-first, no build step, no framework.

```
projects/dizarch/
├── index.html          the page — edit this
├── css/style.css       the design system and layout
├── js/app.js           light, reveals, the colour lab, the form
├── fonts/              Vazirmatn variable (SIL OFL)
├── vendor/             GSAP, ScrollTrigger, Lenis (vendored, no CDN)
├── assets/             ← your hero image or video goes here
├── build.py            makes dist/index.html, everything inlined
└── dist/index.html     generated — one self-contained file
```

Open it with any static server; `file://` will not load the font.

```bash
python3 -m http.server 8000     # then visit localhost:8000
```

## The idea

The studio's expertise is light, so the page is lit. One light source travels
down the page as you scroll, and its colour temperature moves through a day —
cool north light at the hero, golden hour at the story, lamp light at the
contact form. The section eyebrows are clock times because that sequence is
real, not decoration.

The signature moment is the **colour lab** in the "رنگ و نور" section: one
paint colour, one slider from candlelight to noon. It demonstrates the thing
the studio sells rather than claiming it.

## The scroll sequence

`#craft` is a pinned stage holding one isometric flat. The viewport stays put
while each scroll switches which **layer of the work** is drawn over the same
model — plan, light, colour, material, build — and the matching copy arrives
with it. The order is the real order of a project, which is the only reason the
steps carry numbers.

The model is generated in `js/app.js` from the `ROOMS` array, not hand-drawn:
each row is `{x, y, w, h}` in metres plus a paint colour, a material and lamp
positions. Change those five rows and the whole flat changes. Walls are built
per room, and only edges on the outer boundary of the plan get full height —
interior partitions stay low, which is what lets you see into every room at
once.

Implementation notes worth knowing before you edit it:

- The stage is pinned by CSS `position: sticky`. GSAP only reports scroll
  progress — handing the same element to ScrollTrigger's `pin` as well makes
  the two fight over positioning.
- `overflow-x: hidden` anywhere up the tree (`body` included) turns that
  ancestor into a scroll container and silently kills the sticky behaviour.
  `overflow-x: clip` does the clipping without that side effect.
- The snap points are `i / 5`, one per step. `i / (n-1)` looks right and is
  wrong: it lands each snap on the boundary of the *next* step.
- Walls animate with a vertical slide, never `scaleY`. GSAP scales around an
  element's bounding box, and an isometric wall's "bottom" is a slope, not a
  line, so scaling skews it.
- A grid track for the model needs `minmax(0, 1fr)`. Bare `1fr` cannot shrink
  below the SVG's intrinsic viewBox width and blows the layout apart on phones.
- Anything translated sideways by an entrance animation must sit inside
  `overflow-x: clip`. In RTL an element parked off-axis counts as document
  overflow, and the whole page shifts sideways until the animation plays.
- Below 60rem and under `prefers-reduced-motion`, the pin is dropped and the
  five steps stack as ordinary sections with the finished flat shown once.

Palette — two opposed lights, never a single accent:

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#14110F` | umber black, warm-biased |
| `--shadow` | `#241D18` | where light does not reach |
| `--stone` | `#8B8279` | mid plaster, secondary text |
| `--lit` | `#EFE7DA` | plaster with light on it |
| `--lamp` | `#E8A33D` | warm light, 2700 K |
| `--north` | `#7C9AA6` | cool light, 6500 K |

## Before it goes live

Everything below is a placeholder. Search the source for `TODO` to find them all.

1. **Hero media** — drop your file in `assets/` and uncomment the `<img>` or
   `<video>` in `index.html`. Until then the aperture renders as a lit plaster
   surface, which is a deliberate state, not a broken image.
2. **Contact details** — phone, email, Telegram handle, address and hours in
   the `#about` section are dummies.
3. **The three numbers** in the story section (projects, years, hours) are
   placeholders. Replace them with real figures or delete the block; publishing
   invented credentials is not worth the risk.
4. **Telegram handle** — `TELEGRAM.username` at the top of the form section in
   `js/app.js`.

## How the form works

The site is static, so there is nothing to POST to. On submit the page
validates, builds the message, copies it to the clipboard and opens Telegram's
share sheet with the text ready; the visitor presses send.

**No bot token is in the page.** A Telegram bot token in client-side JavaScript
is readable by anyone who opens devtools, and can then be used to read the
bot's messages and send as it. If you want submissions to arrive without the
visitor pressing send, the token has to live on a server — a small serverless
function (Vercel, Netlify, Cloudflare Workers) that holds the token and calls
`sendMessage` is the usual answer. Point the form at that endpoint and the
client stays clean.

## Accessibility

- One `h1`, then `h2` per section, `h3` for the items inside them.
- Every input has a real `<label>`; errors appear inline and in a summary at
  the top of the form that takes focus and links to each invalid field.
- Validation runs on blur, not only on submit.
- Visible focus rings, a skip link, and `prefers-reduced-motion` honoured — the
  light stays, the travel stops.
- Body text sits at or above 4.5:1 on its background.
