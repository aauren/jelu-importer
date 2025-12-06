# Development & Automation Guide

This document explains how to work on the Jelu Importer add-on, including tool installation, workflows, and release
preparation.

## Prerequisites

- Node.js 18+ and npm 9+.
- Firefox Developer Edition (easier temporary add-on installs).
- `web-ext` (installed locally via npm dev dependency).
- Optional: `git-lfs` once screenshots/fixtures are tracked.

## Project Setup
```bash
npm install
```

The command installs all dependencies, including the bundler, test libraries, and `web-ext`.

## Common npm Scripts
| Script | Purpose |
| --- | --- |
| `npm run dev` | Runs `web-ext run` with hot reload in Firefox for interactive development. |
| `npm run lint` | Executes ESLint (and TypeScript checks if enabled). |
| `npm run test` | Runs Jest unit tests, covering parser modules and utilities. |
| `npm run build` | Produces a production-ready bundle (minified JS/CSS, processed manifest). |
| `npm run package` | Calls `web-ext build` to generate the `.xpi`/`.zip` artifact stored under `dist/`. |
| `npm run clean` | Removes build artifacts (`dist`, `.web-ext-artifacts`). |

Adjust or extend the scripts inside `package.json` as the codebase grows.

## Development Workflow

1. **Configure Environment** – no env vars needed; the options page stores dev credentials.
2. **Implement Features** – follow the architecture in `docs/architecture.md`. Keep parsers isolated and well-tested.
3. **Run Tests & Linting** – `npm run lint && npm run test` before opening a PR.
4. **Manual QA** – `npm run dev` launches Firefox with a temporary profile to visit supported sites and trigger imports.
5. **Document Changes** – update docs in `docs/` when parser behavior or configuration steps change.

## Packaging & Releases

1. Bump versions in `manifest.json` and `package.json`.
2. Run `npm run build && npm run package`.
3. Sign the generated artifact via the Firefox Add-on Developer Hub or `web-ext sign` (requires API credentials).
4. Upload the signed `.xpi` plus release notes to GitHub Releases.

## Testing Strategy

- **Unit Tests:** Focus on parser output (using saved HTML fixtures) and shared utilities.
- **Integration Tests:** Mock `browser` APIs (via `webextension-polyfill` mocks) to cover popup/background messaging.
- **Manual Verification:** Because DOM structures change frequently, spot-check each supported provider after major UI
  updates.

## Coding Guidelines

- Prefer TypeScript for type safety (or strongly typed JSDoc if staying in JS).
- Keep parser logic in domain-specific modules and share sanitization helpers.
- Note in commit messages when a parser handles a new DOM revision or site layout.

## Future Enhancements

- Add automated screenshots for README placeholders once the UI stabilizes.
- Introduce Playwright-based smoke tests that drive Firefox via `web-ext run`.
- Wire npm scripts into GitHub Actions to build, lint, test, and package on each push.
