# The Daily Brief

A mobile-first news aggregator built with Angular 22, standalone components, signals, TypeScript, and SCSS, backed by an Express API. Headlines are combined from RSS feeds and optional NewsAPI/GNews accounts, deduplicated, ranked, and cached. Gemini summaries are requested only when a reader expands a story.

## Requirements

- Node.js 22.22 or newer
- npm 10 or newer

## Setup

```powershell
npm install
npm install --prefix server
Copy-Item .env.example .env
```

RSS is the default source and needs no API keys. Add optional `NEWS_API_KEY` and/or `GNEWS_API_KEY` to `.env`. Add `GEMINI_API_KEY` to enable generated summaries; without it, expanded cards use the publisher description. Never add keys to Angular source or client environment files.

Feed URLs can be overridden with the `RSS_*_URL` variables. RSS availability and publisher terms can change; unavailable feeds are reported in the API response while working sources continue to appear.

## Run

Start the Angular dev server and Express API together:

```powershell
npm run dev
```

Open <http://localhost:4200>. The API listens on <http://localhost:3001>; check <http://localhost:3001/api/health>. Angular proxies `/api` requests to Express during development.

Run only the API with `npm run server:dev`, or only Angular with `npx ng serve --proxy-config proxy.conf.json` (the API must also be running for headlines).

## Verify

```powershell
npm test
npm run build
```

`npm test` runs server aggregation/service tests and Angular tests. The production build compiles both applications.

## Project map

- `src/app/core/models/` — client article contract
- `src/app/core/services/` — API access and signal-backed feed store
- `src/app/features/news-feed/` — filtering, feed layout, article cards, and lazy summary interaction
- `src/app/shared/components/` — theme control
- `server/src/providers/` — provider interface plus RSS, NewsAPI, and GNews adapters
- `server/src/aggregation/` — article normalization, title similarity, deduplication, category mapping, and ranking
- `server/src/services/` — 10-minute feed cache and Gemini summary cache/queue/quota controls
- `server/src/routes/` — `/api/news`, `/api/summarize`, and `/api/health`

## Behavior and limits

The Today feed covers the previous 24 hours. Story importance combines exponential recency decay and unique-publisher coverage. Similarity matching uses normalized title-token overlap. The API keeps feed responses for 10 minutes; summary results are cached for 24 hours by canonical article URL or article id.

Gemini per-minute/day limits, per-IP request limits, concurrency, and queue size are configurable in `.env.example`. The counters and caches are in-memory and reset when the server restarts, so run one API instance unless you replace them with shared storage. The summary endpoint accepts bounded article metadata and never fetches the submitted URL.

## Next steps

Useful follow-ons include saved source/category preferences, bookmarks with persistent storage, richer language-aware categorization, and an optional Gemini-generated Top 5. For multi-instance deployment, move caches and quotas to shared storage and add durable rate limiting.
