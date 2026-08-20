# Darrell Nicholas — portfolio site

Single-page site for Darrell Nicholas, independent author and app developer:
the books, the Vector app, the bio, and an email signup.

Plain HTML, CSS and one small JavaScript file. No build step, no framework, no external
requests (no web fonts, no analytics, no CDN). It loads in one round trip plus assets.

## Files

```
index.html          the whole site (hero, books, app, about, contact)
LICENSE             MIT for the code, all rights reserved for the content
styles.css          all styles, mobile-first
script.js           sticky nav, scroll reveal, Netlify form submit
thanks.html         no-JS fallback landing page for the signup form
netlify.toml        publish dir, cache + security headers
assets/
  covers/           book covers (see below)
  vector-icon.svg   Vector app icon
  og.png            1200x630 link preview image for Facebook/X
  favicon.svg, apple-touch-icon.png
incoming/           drop original cover art here, then run ./optimize-covers.sh
optimize-covers.sh  resizes covers to web size using macOS sips
```

## Book covers

The site expects three files:

```
assets/covers/ai-agents-small-business.jpg
assets/covers/ai-credit-repair.jpg
assets/covers/grok-money.jpg
```

Until they exist, each card falls back to a brand-coloured block with the book title on it —
nothing looks broken. To add the real art: put the originals in `incoming/` using those same
names and run

```bash
./optimize-covers.sh
```

It writes 900px-tall JPEGs (usually 60–120 KB each) into `assets/covers/`.

## Local preview

```bash
python3 -m http.server 4321
```

Then open http://localhost:4321.

## Deploying to Netlify

Connect this repository in Netlify (Add new site → Import an existing project). No build
command is needed; `netlify.toml` already sets the publish directory to the repo root.
Drag-and-drop of the folder onto Netlify works too.

## The signup form

The contact form uses **Netlify Forms** — no backend. Netlify detects the `data-netlify="true"`
form at deploy time and collects submissions under **Forms → updates** in the site dashboard.

Two things to do once after the first deploy:

1. **Email notifications** — without these, submissions only pile up in the dashboard.
   Netlify → **Project configuration → Notifications → Emails and webhooks →
   Form submission notifications → Add notification**. Enter your email and pick the
   `updates` form (or all forms).

   Because the form has a field literally named `email`, Netlify sets the `Reply-to`
   header on those notifications — so you can answer a subscriber straight from your inbox.

   If nothing arrives, check spam first; Netlify's notification mail is sometimes delayed
   or filtered.

2. **Spam** — the form already carries a honeypot field (`bot-field`), which stops the
   usual drive-by bots. Only turn on reCAPTCHA (Netlify → Forms → Spam filtering) if junk
   actually starts coming through; it costs every real visitor a puzzle.

Netlify's dashboard navigation moves around from time to time. If a path here is stale,
search the dashboard for "form notifications" rather than hunting through menus.

`script.js` submits the form with `fetch` so the visitor never leaves the page. With
JavaScript disabled the same form posts normally and lands on `/thanks.html`.

## Custom domain

The site deliberately hardcodes no domain — it works on whatever Netlify URL it lands on.
Once a real domain is in place, three optional additions to `index.html` help search engines
and link previews:

```html
<link rel="canonical" href="https://your-domain/">
<meta property="og:url" content="https://your-domain/">
<meta property="og:image" content="https://your-domain/assets/og.png">
```

Point them only at a domain you actually control. A canonical tag aimed at a domain someone
else owns hands them credit for the content.

## Brand

| Token | Hex |
| --- | --- |
| Primary blue | `#3162EF` |
| Accent orange | `#FF723A` |
| Light background | `#F7F8FC` |
| Ink (text) | `#0B0D12` |

Taken from the published book cover. They live at the top of `styles.css` as CSS custom
properties — change them there and the whole site follows.

## License

The code — HTML, CSS, JavaScript, the cover-resize script — is MIT licensed. Take any of it.

The content is not: the site copy, the bio, the book titles and descriptions, the cover art,
the Vector icon and the name stay all rights reserved. The full wording is in [LICENSE](LICENSE).
