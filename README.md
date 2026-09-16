# Newzpage

An RSS reader that typesets your feeds as the front page of an old newspaper. Article titles become headlines,
a locally computed extractive summary becomes the body copy, and the story's photograph is printed as a halftone.

Every reader keeps their own newspaper in their own browser: the feeds, their order, the page title and the
summaries all live in `localStorage`. The server holds no reader data; it only does what a browser cannot do
itself (fetch feeds and pages, extract and rank text). Live at [newz.page](https://newz.page).

```bash
npm install
npm run dev        # http://localhost:3000
```

`feeds.json` holds the **house defaults**: the wires a first-time visitor starts with. From then on the reader's
own copy rules, editable in the composing room.

```json
{
  "title": "Newzpage",
  "tagline": "All the feeds that are fit to print",
  "itemsPerFeed": 10,
  "feeds": [
    { "name": "BBC News", "url": "https://feeds.bbci.co.uk/news/rss.xml", "limit": 11 },
    { "url": "https://news.ycombinator.com/rss" }
  ]
}
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (Node's built-in runner, via `tsx`) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run build && npm start` | Production build and server |
| `npm run summarize -- <url> [--words 120]` | Summarise any article from the command line, with timings and the top-ranked sentences |
| `npm run directory` | Rebuild the bundled feed directory from the curated list, keeping only feeds that work |

Environment variables are documented in `.env.example`.

## The composing room

[`/settings`](http://localhost:3000/settings) is where a reader edits their newspaper: search for feeds by topic,
language or site and add them with one click, or add a feed by URL (its title is taken from the feed); rename
feeds, give each its own story count, drag them into order (or use the arrow buttons), remove them with an undo;
set the page title and tagline; export the configuration as a file and import it in another browser; or go back
to the house defaults (after a confirmation). Every change is saved as it is made; text
fields save half a second after the last keystroke and when they lose focus.

The search proposes feeds from three places: a site's own feeds when the terms are a web address (announced
`<link rel="alternate">` feeds and the usual paths), the bundled directory in `src/lib/feeds/directory.json`
(200 well-known feeds), and feedly.com's public feed search for everything else. Set
`NEWZPAGE_FEED_SEARCH=directory` on the server to keep searches entirely in-house.

## How an edition is composed

The page is a static shell; the browser composes the edition:

1. **Configuration** is read from `localStorage` (a first visit fetches `/api/defaults` once and keeps it).
2. **Feeds** are requested from `/api/feed?url=…&limit=…`. The server fetches each feed with a conditional
   request (ETag / Last-Modified), parses RSS 2.0, Atom 1.0 and RSS 1.0 into one shape, and returns the items
   without their HTML. It keeps parsed feeds in process memory for the feed's own `ttl` (5 minutes – 6 hours;
   15 minutes when unspecified) and serves the last snapshot, marked stale, when a refresh fails.
3. **Summaries** come from this browser's cache when it has them, otherwise from `/api/article?url=…&feed=…`.
   The server uses the feed's full text when the feed carries it, and fetches the page otherwise (browser-like
   headers, 12 s timeout, 3 MB cap, HTML only) with Mozilla's Readability extracting the article. Feed
   descriptions are the fallback; failing that, the story is printed with a placeholder line and a link.
   The result is a ranked analysis, not a fixed-length summary, so any block size can be composed from it.
4. **Photographs**: candidates are collected from Media RSS, enclosures, inline `<img>` tags, `og:image`,
   `twitter:image` and `link[rel=image_src]`; tracking pixels, logos, icons, vector graphics, tiny and
   banner-shaped images are filtered out.
5. **Layout**: the page maker (`src/lib/edition/pagemaker.ts`) sets each section in full-width bands. The lead
   (first story in the top three with a photo and enough text) sets the first band's height; later bands are cut
   into slots of varying column spans drawn from patterns with a seed from the story ids, so the page looks the
   same on every reload. A slot holds one story or a short stack; the richest story of each band anchors its
   widest slot; thin stories are stacked and demoted to run-in briefs. Word budgets are estimated from a height
   model so every slot reaches the band height, then corrected from the rendered heights before paint
   (`fitBudgets`): anchors are never cut, other slots gain or lose whole sentences, and residual slack is taken
   up by stretching photographs and spacing stacked items. Photographs are rationed to about one story in three,
   with wide blocks using 16:9 crops. Narrow blocks are set ragged-right; wide ones run two or three text columns.
6. **Older**: a button under each section asks the feed for a larger slice (the wire's own story
   count more each time, up to fifty items) and typesets the items that follow the last one already on the
   page, further down the wire, as more bands below the existing ones, which stay put. Items that arrived since
   the edition was printed are left for the next edition. The button always stays; when the wire has nothing
   older it says so. Loading more does not count as a new edition.
7. **Print**: photographs are turned into halftones with CSS filters, multiplied over the paper texture, with a
   dot screen overlaid. Images that fail to load remove themselves.

## Storage

Everything a reader configures or that is computed for them is stored in their browser:

| Key | Contents |
| --- | --- |
| `newzpage.config.v1` | title, tagline, feeds in order with their story counts |
| `newzpage.articles.index.v1` | index of cached analyses: size, last use, expiry |
| `newzpage.article.v1.<hash>` | one cached analysis per article |
| `newzpage.reader.v1` | when this browser first printed an edition, how many it has printed, and the last edition's fingerprint (the masthead's volume counts the months since the first edition; the number counts editions with new stories) |

The summary cache is **rolling**: at most 400 entries and about 3 MB (`SummaryCache` in
`src/lib/client/summary-cache.ts`). When either limit is passed, or when the browser reports its quota is full,
the least recently used entries are dropped until the new one fits. Entries expire after 30 days when they came
from real text and after one hour when only the feed's description was available (the page could not be read, so
it is worth trying again soon). The composing room has a "Forget cached summaries" button for a clean slate. A story that produced no copy
at all (an unreachable page, a page without readable text) is never stored, in the browser or on the server, so
it is tried again on the next load. Each entry
carries the summariser version; bumping `SUMMARIZER_VERSION` in `src/lib/summarize/types.ts` invalidates them.

The server keeps only a bounded in-memory cache of feeds and analyses (so many readers do not fetch the same
site repeatedly) that disappears on restart.

## The summariser

No external service is involved. `src/lib/summarize` implements extractive summarisation:

- **Segmentation** uses `Intl.Segmenter` for sentences and words, with a merge pass for abbreviations, initials
  and month names that ICU splits on ("Dr. Smith", "Jan. 5"), and a repair for text that was glued together while
  scraping ("passed.Opponents").
- **Cleaning** removes citation markers, balances quotation marks split across sentences, and drops junk:
  boilerplate (cookies, newsletters, "read more"), URLs, code and tables, headings without terminal punctuation,
  fragments that start mid-sentence, author-bio paragraphs, duplicates, and a repeated headline.
- **Language** is detected from stopword density (English, Dutch, German, French; the declared language wins when
  plausible). It selects the stopword list, a light English stemmer, and the `lang` attribute used for hyphenation.
- **Ranking** is TextRank: sentences are TF-IDF vectors, cosine similarity forms a graph, PageRank gives
  centrality. That score is multiplied by priors that make a sentence good *as a summary sentence*: early position
  (news is written top-down), overlap with the headline, moderate length, and penalties for anaphoric openers
  ("He said…", "This means…"), questions and quotes.
- **Selection** orders sentences by maximal marginal relevance so a second sentence about the same fact does not
  displace one about a different fact. `compose()` (pure, runs in the browser) then walks that order until the
  word budget of the block is spent, and prints the picks in reading order, grouped into short paragraphs.

Runtime is a few milliseconds per article; fetching and DOM parsing dominate.

## Deploying

The app runs anywhere Next.js runs; it is deployed at [newz.page](https://newz.page) on Vercel. Two things matter:

- **Node.js 24.** The project is developed and tested on Node 24, and `package.json` declares
  `"engines": { "node": "24.x" }`, the form Vercel reads. Older runtimes break jsdom: its dependencies include ES
  modules loaded with `require()`, which Node before 22.12 refuses (`ERR_REQUIRE_ESM`). Check the project's
  Node.js version in Vercel (Settings → General) says 24.x. Should Readability still be unavailable, articles
  are extracted with a DOM-free fallback (the paragraphs of the page's `<article>`), so summaries degrade rather
  than vanish; hovering a placeholder line shows the reason a story has no copy.
- **Function duration.** Fetching and extracting an article can take longer than a serverless platform's default
  of ten seconds, so the API routes declare `maxDuration` (60 s for articles). On the Vercel Hobby plan that is the
  maximum; lower plans' limits apply otherwise.

The server keeps only an in-memory cache, so on serverless platforms every cold start begins empty; readers' browsers
hold the long-lived summary cache, which is what makes this cheap enough.

Page views are counted with Vercel Web Analytics (`@vercel/analytics`, mounted in the root layout). It is cookieless
and records no personal data; the colophon tells readers so and links to Vercel's analytics privacy policy. Remove
the `<Analytics />` element from `src/app/layout.tsx` when deploying elsewhere.

## Serving readers you do not know

Because the server fetches addresses that readers type in, it refuses anything that resolves to a loopback,
link-local or private address (and follows redirects by hand so every hop is checked). Set
`NEWZPAGE_ALLOW_PRIVATE_URLS=1` for a home network. The API is same-origin and unauthenticated; put a
rate limiter in front of it if the deployment is public.

## Why this shape

This is the fourth start of the project. The earlier three (`newzpage-lambda`, `newzpage-legacy` and the previous
contents of this repository) taught the same lessons from different angles:

- **External summarisers were the weak point every time.** SMMRY (2019) and OpenAI (2024) cost money, need keys,
  add seconds of latency per article, and make the cache a requirement rather than an optimisation. The 2022
  attempt already had a self-written frequency-based summariser; it worked but scored on raw word counts over raw
  `<p>` scrapes. This version keeps the idea and upgrades both halves: Readability for the text, TextRank plus
  news-specific priors for the ranking.
- **Infrastructure outgrew the reader.** A Spring Boot service on AWS, then Express plus a separate CRA frontend,
  then MongoDB with three collections and a Docker Compose file. Now the server is stateless and each reader's
  browser is their database, which also means any number of readers can share one deployment.
- **Layout by JavaScript resize handlers** (2022) is replaced by CSS multi-column flow with `break-inside: avoid`,
  which balances columns exactly the way a compositor would.

## Layout of the code

```
feeds.json                    house defaults for first-time readers
src/app                       Next.js entry: layout (fonts), static page shell, styles
src/app/api                   feed, article, search and defaults endpoints (the only server work)
src/app/settings              the composing room (client-side, localStorage)
src/components                masthead, feed section, story block, photo, skeleton, colophon, front page
src/lib/client                localStorage config store, rolling summary cache, API client, hooks
src/lib/config-schema.ts      configuration shape shared by server defaults and browser copies
src/lib/config.ts             feeds.json loader (server defaults)
src/lib/feeds                 feed fetching and parsing, feed search: directory, site discovery, feedly
src/lib/articles              page fetching, Readability extraction, image candidate selection
src/lib/summarize             segmentation, stopwords/language detection, TextRank, analyze (server) / compose (anywhere)
src/lib/cache                 in-memory TTL/LRU cache for the server
src/lib/edition               server builder (feed → items, item → analysis) and layout planner (stories → blocks)
src/lib/util                  text, hashing, concurrency limiter, HTTP helpers with address guard, time formatting
scripts/build-directory.ts    curated candidate list → validated directory.json
```

## Known limits

- Sites that block non-browser clients (HTTP 403) or need JavaScript to render fall back to the feed description.
- Feeds and pages are decoded from their declared charset; exotic encodings fall back to UTF-8.
- Summaries are extractive: sentences are quoted verbatim, never rewritten. Long reads are summarised from
  their first 400 sentences.
- Stopword lists exist for English, Dutch, German and French; other languages are ranked without stopword removal.
- A browser that blocks storage (some private windows) still works, but forgets everything when the tab closes.

## Fonts

Masthead: Traditional Gothic (Dieter Steffmann). Headlines: Playfair Display (OFL). Body: Libre Caslon Text
(OFL), chosen over Old Standard TT because its sturdier strokes stay readable on the paper texture. All are
served from `src/fonts`; nothing is loaded from third parties at runtime.
