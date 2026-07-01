# CO3 Customer Portal — User Handbook

An interactive, illustrated guide to the **CO3 Customer Portal** for shippers and carriers.
It walks through every screen — inviting carriers, tracking shipments, managing the connected
fleet and saved locations, consents, subscriptions, and branded invitation emails — with
annotated screenshots captured live from the portal.

## View it

- **Locally:** open `index.html` in any modern browser (no build step, no server required).
- **Hosted (share.co3.io):** the handbook is published to a share.co3.io project.
  Every push to `main` runs the **Deploy** workflow (`.github/workflows/deploy.yml`),
  which uploads the site files to the project root. Read access is gated by Keycloak SSO.

## What's inside

| File | Purpose |
|------|---------|
| `index.html` | The handbook — all sections and content |
| `styles.css` | Design system (light + dark themes) |
| `app.js`     | Search palette (⌘K), scroll-spy, lightbox, theme toggle, progress bar |
| `assets/screens/` | Annotated screenshots referenced by the page |

## Features

- Sticky, scroll-synced navigation and a 5-card quick start
- **⌘K / Ctrl-K command-palette search** across every section
- Screenshots framed in a browser chrome with numbered legends and click-to-zoom lightbox
- Light / dark theme, reading-progress bar, fully responsive (desktop → mobile)
- Keyboard-accessible with a skip link, focus management and reduced-motion support

## Deploy

Deployment is automatic: pushing to `main` triggers `.github/workflows/deploy.yml`,
which runs `scripts/share-deploy.sh` to upload the site to share.co3.io **in place**
— files at the project root are overwritten, so the URL stays stable.

**One-time setup:** add a repository **secret** `SHARE_API_KEY`
(*Settings ▸ Secrets and variables ▸ Actions ▸ Secrets ▸ New repository secret*).
The target project id is set in the workflow (`SHARE_PROJECT`); override it with a
repo **variable** of the same name if it ever changes.

**Manual / local deploy:**

```bash
SHARE_API_KEY=<key> SHARE_PROJECT=<project-id> bash scripts/share-deploy.sh .
bash scripts/share-deploy.sh --dry-run   # preview file list, no upload
```

> The API key has write + delete privileges — keep it in **Secrets**, never in a
> plaintext variable, and never commit it.

## Notes

- The interface language is **English**, matching the portal UI shown in the screenshots.
- Figures in the screenshots come from a demo workspace and are **illustrative** — a real
  tenant shows its own partners, vehicles, locations and shipments.
- Layouts and labels may evolve as the product is improved; update the screenshots in
  `assets/screens/` and the matching section when they do.
