# KeepItBack Particle Text Effect

A minimal black-screen particle text demo displaying “KeepItBack”. Right-click and drag across the canvas to scatter particles.

## Run locally

- `npm run dev` starts the Vite development server.
- `npm run build` type-checks and builds the production site into `dist/`.
- `npm run lint` runs Oxlint.

Built with React, TypeScript, and Vite.

## Search indexing

The `public/` directory includes `robots.txt`, `sitemap.xml`, and `llms.txt`; Vite copies them to the site root during production builds. After deploying to `https://keepitback.in/`, verify the domain in Google Search Console and submit `https://keepitback.in/sitemap.xml`. These files help crawlers discover the page, but indexing and search position are determined by search engines and cannot be guaranteed.
