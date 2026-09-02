# TakeoffAI Marketing Website

## What this is
Public-facing marketing site for TakeoffAI, served at **takeoffai.com.au**.
The product app lives separately at `app.takeoffai.com.au` (sign-up: `/signup`, login: `/login`).

## Structure
Plain HTML/CSS/JS, no build step. One HTML file per page, all sharing the same stylesheet and script:

| URL        | File            | Purpose |
|------------|-----------------|---------|
| `/`        | `index.html`    | Home: "try it free" and "book a call" side by side, Simpro integration, Cal.com booking, pricing summary |
| `/product` | `product.html`  | Interactive walkthrough (the 4-step tour), features, exports, ROI calculator |
| `/simpro`  | `simpro.html`   | Simpro integration page (not in nav or sitemap until the partnership is finalised) |
| `/pricing` | `pricing.html`  | Plans, credit packs, free-credits offer, pricing FAQ |
| `/compare` | `compare.html`  | vs Groundplan / ConEst / Bluebeam |
| `/demo`    | `demo.html`     | Optional 30-min demo booking (Cal.com embed). `/booking` is an alias |
| `/about`   | `about.html`    | Founders story |
| `/privacy`, `/terms` | `privacy.html`, `terms.html` | Legal |

Shared files:
- `site.css` — design tokens, nav, footer, buttons, sections, cards, FAQ, CTA band. Page-specific CSS goes in that page's own `<style>`.
- `site.js` — nav scroll/active state, mobile menu, FAQ accordion, scroll-in animation, hero-animation play/pause, Meta Pixel `SignupClick` event on any link to the app sign-up.
- `pixel.js` — Meta Pixel init, loaded on every page.
- `takeoffai-hero-animation.html` — the animated product demo embedded in an iframe on the home page.
- `vercel.json` — clean-URL routes. Add a route here when adding a page. `sitemap.xml` lists every page.

## Conventions
- **Nav and footer are duplicated verbatim in every page.** When changing a link, change it in all nine HTML files (a `grep -l 'nav-links'` finds them).
- Cache-bust `site.css` / `site.js` by bumping the `?v=` query in every page's `<link>`/`<script>` when you change them.
- Brand is **Simpro** (not SimPro). The Simpro partnership is NOT finalised (Sept 2026): the site says TakeoffAI "connects to Simpro" and nothing about being a partner. Don't add partner badges or claims until Jonah confirms.
- Facts the copy relies on (verify in the app before changing): free account gives 2,000 credits, no card; commercial take-off = 1,000 credits, residential = 500; Solo $149/mo, Contractor $349/mo, Unlimited $749/mo (coming soon); packs 1,000/$100, 5,000/$450, 15,000/$1,275.
- Two CTAs everywhere, equal weight: "Try it free" → `https://app.takeoffai.com.au/signup` and "Book a call" → `/demo` (on the home page, `#book-call`, which has the Cal.com embed).

## Local preview
```bash
vercel dev        # http://localhost:3000
# or, without routes: python3 -m http.server 8000
```

## Deploy
Push to `main` on GitHub → Vercel auto-deploys within ~30 seconds.
```bash
git add . && git commit -m "your change" && git push
```

## Domain DNS (already configured)
DNS records are set at the registrar pointing to Vercel. Domain settings: Vercel dashboard → Project → Settings → Domains.
