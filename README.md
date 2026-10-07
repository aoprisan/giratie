# Girație

Traffic simulation of the two signalised roundabouts on Piața Unirii in Sibiu (Milea × Calea Dumbrăvii,
Piața Unirii · Ramada). Switch each between give-way and signals and watch the queues.

Live: https://aoprisan.github.io/giratie/

    npm ci
    npm run dev          # dev server with hot reload
    npm run build        # -> dist/index.html (single self-contained file)
    npm test             # vitest unit tests
    npm run scenarios    # headless scenario comparison (optional seed: npm run scenarios -- 42)

A `justfile` wraps the same commands (`just build`, `just test`, `just scenarios`, `just serve`).

Pushes to `main` are built, tested and deployed to GitHub Pages by `.github/workflows/pages.yml`.

See `CLAUDE.md` for the model and its limits. Background:
https://www.turnulsfatului.ro/2026/10/06/un-pic-de-haos-domnule-un-singur-semafor-de-giratoriu-a-pornit-marti-dimineata-tocmai-cel-unde-pietonii-erau-obligati-sa-se-amestece-printre-masini/
