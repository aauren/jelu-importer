# Architecture & Feature Overview

## Project Goals

- Provide a Firefox toolbar action that scrapes the currently viewed book page on demand.
- Support high-value metadata fields for Jelu (title, cover, IDs, narrators, publisher, etc.).
- Keep the code portable enough to later ship on Chromium-based browsers.
- Offer optional editing before import and make the workflow scriptable via npm tasks.

## Major Components

1. **Browser Action Popup**  
   Triggered only when the user clicks the toolbar icon. Requests scrape results for the active tab, displays an
   editable form, shows API status, and exposes the “Add to my library” toggle (default comes from the options page).
2. **Background Service Worker / Script**  
   Stores user preferences loaded from `browser.storage.local`, orchestrates scraping, merges defaults with user edits,
   and performs REST calls to the Jelu API while managing notifications/logging/throttling.
3. **Options Page**  
   Collects Jelu base URL, username/password, and UX preferences (default tags, auto-add-to-library). Shows an explicit
   warning that credentials are stored unencrypted so users can create a dedicated low-privilege account if desired.
4. **Content Scripts + Site Parsers**  
   Injected on supported domains (Goodreads, Amazon Books, Amazon/Audible, Google Books). Each parser implements a
   common interface so the popup stays generic and only switches by hostname/path.

## Parser Interface
Each site-specific parser implements a shared contract so that the popup can remain generic:

```ts
export interface ScrapedBook {
  source: 'goodreads' | 'amazon' | 'audible' | 'google-books' | string;
  sourceUrl: string;
  title: string;
  subtitle?: string;
  authors: string[];
  narrators?: string[];
  description?: string;
  coverImage?: string;
  identifiers: {
    isbn10?: string;
    isbn13?: string;
    asn?: string;
    amazonId?: string;
    goodreadsId?: string;
  };
  series?: {
    name?: string;
    number?: string;
  };
  publisher?: string;
  publishDate?: string;
  pageCount?: number;
  tags?: string[];
}
```

Shared helpers handle DOM querying, trimming, date parsing, and link normalization. Parser churn is localized to their
respective modules, making future fixes manageable.

## Data Flow

1. User clicks the toolbar button.
2. Popup asks the background script for scrape data.
3. Background verifies the host is supported, injects content script if needed, and awaits a `ScrapedBook` payload.
4. Popup renders the payload, allowing edits before submission.
5. On confirmation, popup sends the edited payload to the background script.
6. Background transforms the payload into Jelu's API schema and calls the REST endpoint, surfacing success/failure back
   to the popup.

## Authentication & Storage

- The extension always authenticates via HTTP Basic using the username/password provided on the options page (stored
  as-is with a visible warning).
- Credentials and preferences live in `browser.storage.local` only; nothing is synced.
- Optional enhancement: let privacy-conscious users enter credentials per session instead of persisting them.

## CLI Tooling & Automation

- `npm run dev` – launch `web-ext run` with hot reload for Firefox.
- `npm run lint`, `npm run test`, `npm run format` – keep the codebase healthy.
- `npm run build` – bundle/minify assets (esbuild at the moment, easily swappable).
- `npm run package` – produce distributable `.xpi` artifacts.

Additional tooling goals:

- Add `eslint`, `prettier`, and `jest` (with `jsdom`) for parser unit tests.
- Use `npm` + `web-ext` + GitHub Actions to automate lint/test/build and eventually signing/publishing releases.

## Future Work

- Implement Chromium-specific manifest tweaks once the Firefox build stabilizes.
- Add GitHub Actions workflows that run lint/test/build on push and optionally sign/publish releases.
- Expand documentation with parser-specific troubleshooting notes and site quirks.
