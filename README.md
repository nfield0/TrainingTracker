# Site Training Tracker

A site-centric training tracker for MAS support staff. Sites own a set of
quiz **components**; most are shared org-wide (Safety, Support Stage 1–3,
Conveyor, Lift, Hydraulic Taxi) and some can be unique to a site. Quiz scores
are stored **per person, per quiz** and shared across every site that uses
that quiz, while the **Trained** date stays per-site.

Built with React + Vite + Tailwind CSS. Data is saved to `localStorage`, so it
persists in the browser you use. There's also Export / Import (JSON) in the
header for backup or moving between machines.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer (includes `npm`).

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server (prints a localhost URL)
```

Open the printed URL (usually http://localhost:5173) in your browser.

## Build for deployment

```bash
npm run build    # outputs a static site to ./dist
npm run preview  # preview the production build locally
```

The contents of `dist/` are plain static files — host them anywhere (internal
web server, IIS, Netlify, GitHub Pages, etc.). No backend is required.

## Project layout

```
site-training-tracker/
├── index.html              # HTML entry
├── package.json            # scripts + dependencies
├── vite.config.js          # Vite + React plugin
├── tailwind.config.js      # Tailwind content globs + theme tweaks
├── postcss.config.js       # Tailwind + autoprefixer
└── src/
    ├── main.jsx            # entry; localStorage storage shim; renders <App/>
    ├── App.jsx             # the whole tracker (views, data model, modals)
    └── index.css           # Tailwind directives + base styles
```

## Data & persistence

- All state lives under a single `localStorage` key
  (`moffett-site-training-tracker:v1`).
- Use **Export** to download a JSON backup and **Import** to restore it.
- **Reset to original sheet data** (Overview tab) restores the seeded sites,
  people and training dates.

## Notes

- Tailwind is compiled at build time (no CDN), so styling works fully offline.
- The four numeric `min-w-*` steps used by the data tables are declared in
  `tailwind.config.js`.
