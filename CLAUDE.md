# TakeoffAI Marketing Website

## What this is
Public-facing marketing/landing page for TakeoffAI, served at **takeoffai.com.au**.
The product app lives separately at `app.takeoffai.com.au`.

## How to make changes
- Edit `index.html` directly — that is the entire site.
- Any images or assets go in `assets/`.
- Push to `main` on GitHub → Vercel auto-deploys within ~30 seconds.

## Stack
- Plain HTML/CSS/JS (no build step)
- Hosted on Vercel (static site)
- Domain: takeoffai.com.au

## Local preview
```bash
vercel dev
# Site available at http://localhost:3000
```

## Deploy
```bash
git add .
git commit -m "your change description"
git push
# Vercel picks it up automatically
```

## Domain DNS (already configured)
DNS records are set in the domain registrar pointing to Vercel.
To update domain settings: Vercel dashboard → Project → Settings → Domains.
