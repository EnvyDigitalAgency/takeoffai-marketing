# TakeoffAI Marketing Website

## What this is
Public-facing marketing site for TakeoffAI, served at **takeoffai.com.au**.
The product app lives separately at `app.takeoffai.com.au` (sign-up: `/signup`, login: `/login`).

## Structure
Plain HTML/CSS/JS, no build step. One HTML file per page, all sharing the same stylesheet and script:

| URL        | File            | Purpose |
|------------|-----------------|---------|
| `/`        | `index.html`    | Home: "try it free" and "book a call" side by side, priced-BOQ section, Cal.com booking, pricing summary |
| `/how-it-works` | `how-it-works.html` | Lead endpoint (the link sent to leads): 90-second founder VSL (`assets/vsl.mp4`, autoplays muted with burned-in captions, tap for sound), one primary CTA to the on-page Cal.com calendar, FAQ. Deliberately has no main nav and a single primary CTA; linked from the footer only. `?name=&email=` prefill the calendar |
| `/product` | `product.html`  | Interactive walkthrough (the 4-step tour), features, exports, ROI calculator |
| `/estimating` | `estimating.html` | TakeoffAI Estimating, the done-for-you service (Oct 2026). Warm off-white (#F7F6F2) leads, black for contrast. "Send us a job" form posts to `api/estimating-lead.js`; "Book a quick call" opens the same Cal.com 30-min event with notes "Estimating service enquiry" and `metadata[source]=estimating`. Meta pixel events `estimating_lead`, `estimating_call_click`. Hidden `#results` section waits for real results |
| `/walkthrough` | `walkthrough.html` | The 90-second founder VSL (same file as `/how-it-works`) at the top, then the five-minute app walkthrough with chapters, plus the 8-second review loop |
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
- Video assets live in `assets/` and are committed to git (keep each under ~20 MB: re-encode with ffmpeg, 720p, CRF 23, `-movflags +faststart`). Source cuts of the VSL are in Jonah's Downloads (`takeoffai_vsl_short.mp4` is the 9:16 captioned master).
- `api/estimating-lead.js` — Vercel function behind the estimating form: writes a row to the "TakeoffAI Lead CRM" sheet (Leads tab, Source = "Estimating page", at an explicit row because column A is hidden and the Sheets append API shifts rows right) and emails info@ via Resend. Needs Vercel env vars `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY` (from `../service_account.json`), `CRM_SHEET_ID`, `RESEND_API_KEY` (from `../.env`), optional `LEAD_NOTIFY_EMAIL`. Lead IDs start `web-est-` and Auto Email is written as `manual_contact`, which is what Grokbot's 8:05am cold emails skip on, so estimating leads never get the software emails.
- `vercel.json` — clean-URL routes. Add a route here when adding a page. `sitemap.xml` lists every page.

## Conventions
- **Nav and footer are duplicated verbatim in every page.** When changing a link, change it in all HTML files (a `grep -l 'nav-links'` finds them).
- Cache-bust `site.css` / `site.js` by bumping the `?v=` query in every page's `<link>`/`<script>` when you change them.
- **No Simpro anywhere on the site** (as of 12 Sept 2026, at Simpro's request). All mentions, the `/simpro` page and its route were removed; the copy now talks about a priced bill of quantities exported to Excel/CSV/PDF instead. Don't reintroduce Simpro until Jonah says they're happy for it to appear.
- Facts the copy relies on (verify in the app before changing): free account gives 2,000 credits, no card; commercial take-off = 1,000 credits, residential = 500; Solo $149/mo, Contractor $349/mo, Unlimited $749/mo (coming soon); packs 1,000/$100, 5,000/$450, 15,000/$1,275. Usage proof (Oct 2026, from Jonah): 1,000+ hours saved, 140,000+ symbols counted. No launch date or "since [year]" on the site (Jonah's call). "Australia's first/original" is not on the site either. Jonah is sourcing a customer testimonial to sit beside the 1,000+ stat; don't write one in the meantime.
- Estimating service facts (Jonah, 2 Nov 2026; replaces the 30 Oct "$497" pricing, which must not reappear, nor "$750 starting price" or "per house"): commercial full tender priced by electrical contract value, ex GST: under $50K $595, $50K–$100K $750, $100K–$250K $1,150, $250K–$500K $1,650, $500K–$1M $2,250, over $1M from $3,000 (quoted). Residential: up to 5 sheets $299, 6–15 sheets $449, larger quoted. Budget estimate about half price, back in 24–48 hours. Memberships from $1,690/mo (2+ tenders a month). Tender back at least 48 hours before close (48–72 hour turnaround), addenda re-priced the same day, RFIs on day 1, allowances not lazy exclusions. "$110K+ a year in salary alone" for an estimator; price and turnaround confirmed "the same business day"; guarantee "back by your deadline or it's free" with the fine print linking to `/terms#estimating` (service terms text still to come from Jonah). Don't show yearly deals, payment plans, setup fees or competitor names. No file upload on the form yet, link or email only; the form asks for job size (contract value band or sheet count) and the handler writes it into Notes.
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
