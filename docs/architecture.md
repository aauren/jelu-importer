# Architecture & Feature Overview

## Project Goals
- Provide a Firefox toolbar action that scrapes the currently viewed book page on demand.
- Support high-value metadata fields for Jelu (title, cover, IDs, narrators, publisher, etc.).
- Keep the code portable enough to later ship on Chromium-based browsers.
- Offer optional editing before import and make the workflow scriptable via npm tasks.

## Major Components
1. **Browser Action Popup**
   - Triggered only when the user clicks the toolbar icon.
   - Requests scrape results for the active tab, displays an editable form, and shows API status.
   - Includes an “Add to my library” checkbox whose default comes from the options page.
   - Handles validation (required fields, numeric checks, etc.).
2. **Background Service Worker / Script**
   - Stores user preferences loaded from `browser.storage.local`.
   - Orchestrates scraping flow, merges defaults with user edits, and performs REST calls to the Jelu API.
   - Manages notifications, logging, and throttling to avoid duplicate submissions.
3. **Options Page**
   - Collects Jelu base URL/port, preferred auth strategy (API token or username/password), and UX preferences (default tags, auto-add-to-library).
   - Displays a warning that credentials are stored unencrypted, urging use of API tokens whenever possible.
4. **Content Scripts + Site Parsers**
   - Injected on supported domains (Goodreads, Amazon Books, Amazon/Audible, Google Books).
   - Identify the correct parser module based on hostname/path rules.
   - Return a normalized book payload to the background script.

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

Shared helpers handle DOM querying, trimming, date parsing, and link normalization. Parser churn is localized to their respective modules, making future fixes manageable.

## Data Flow
1. User clicks toolbar button.
2. Popup asks background script for scrape data.
3. Background verifies the host is supported, injects content script if needed, and awaits `ScrapedBook` payload.
4. Popup renders the payload, allowing edits/additions before submission.
5. On confirmation, popup sends the edited payload to the background script.
6. Background transforms the payload into Jelu's API schema and sends it via `fetch`, surfacing success or failure back to the popup.

## Authentication & Storage
- Primary method: Jelu API token; secondary: username/password (stored as-is, with warning text in the UI).
- Credentials and preferences live in `browser.storage.local` only; nothing is synced.
- Optionally support in-session credentials (not persisted) for privacy-conscious users.

## CLI Tooling & Automation
- Use `npm` + `web-ext` for running the extension in Firefox and producing signed packages.
- Add `eslint` and `prettier` for code health, plus `jest` (with `jsdom`) for parser unit tests.
- Provide scripts such as:
  - `npm run dev` – start `web-ext run` with file watching.
  - `npm run lint`, `npm run test`, `npm run format`.
  - `npm run build` – bundle/minify via Vite/Rollup/webpack (to be selected).
  - `npm run package` – produce distributable `.xpi`.

## Future Work
- Implement Chromium-specific manifest tweaks once Firefox build stabilizes.
- Add GitHub Actions workflows that run lint/test/build on push and optionally sign/publish releases.
- Expand documentation with parser-specific troubleshooting notes and site-specific quirks.
