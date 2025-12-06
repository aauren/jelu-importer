# Development & Automation Guide

This document explains how to work on the Jelu Importer add-on, including tool installation, workflows, and release preparation.

## Prerequisites
- Node.js 18+ and npm 9+
- Firefox Developer Edition (for easier temporary add-on installs)
- `web-ext` (installed locally via npm dev dependency)
- Optional: `git-lfs` (when screenshots and large fixtures are added)

## Project Setup
```bash
npm install
```

The command installs all dependencies, including bundler, test libraries, and `web-ext`.

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
1. **Configure Environment Variables** – none are required by default; dev credentials are stored through the options page even in development.
2. **Implement Features** – follow the architecture described in `docs/architecture.md`. Keep site parsers isolated and covered by tests.
3. **Run Tests & Linting** – `npm run lint && npm run test` before opening a PR.
4. **Manual QA** – `npm run dev` launches Firefox with a temporary profile so you can visit supported sites and trigger imports.
5. **Document Changes** – update relevant docs under `docs/` when behavior changes, especially parser quirks or API expectations.

## Packaging & Releases
1. Bump the version in `manifest.json` and `package.json`.
2. Run `npm run build && npm run package`.
3. Sign the generated artifact via the Firefox Add-on Developer Hub or automate the step via `web-ext sign` (requires API credentials).
4. Upload the signed `.xpi` to the GitHub Releases page along with release notes.

## Testing Strategy
- **Unit Tests:** Focus on parser output (using saved HTML fixtures) and utility helpers.
- **Integration Tests:** Mock `browser` APIs (via `webextension-polyfill` mocks) to ensure popup/background messaging works.
- **Manual Verification:** Since DOM structures change frequently, verify each supported provider after major UI updates.

## Coding Guidelines
- Prefer TypeScript for type safety (or strongly-typed JSDoc if staying in JS).
- Keep parser logic in domain-specific modules and share sanitization helpers.
- Always note in commit messages if a parser handles a new DOM revision.

## Future Enhancements
- Add automated screenshots for README placeholders once UI stabilizes.
- Introduce Playwright-based smoke tests that drive Firefox via `web-ext run`.
- Connect npm scripts to GitHub Actions to build, lint, test, and package on each push.
