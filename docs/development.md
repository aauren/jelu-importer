# Development & Automation Guide

This document explains how to work on the Jelu Importer add-on, including tool installation, workflows, and release
preparation.

## Prerequisites

- Node.js 22+ and npm 10+.
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
| `npm run package` | Calls `web-ext build` to generate `.zip` under `artifacts/`. Rename it to `.xpi` for manual installs. |
| `npm run clean` | Removes build artifacts (`dist`, `.web-ext-artifacts`). |

Adjust or extend the scripts inside `package.json` as the codebase grows.

## Development Workflow

1. **Configure Environment** – no env vars needed; the options page stores dev credentials.
2. **Implement Features** – follow the architecture in `docs/architecture.md`. Keep parsers isolated and well-tested.
3. **Run Tests & Linting** – `npm run lint && npm run test` before opening a PR.
4. **Manual QA** – `npm run dev` launches Firefox with a temporary profile to visit supported sites and trigger imports.
5. **Document Changes** – update docs in `docs/` when parser behavior or configuration steps change.

## Continuous Integration

- Every pull request (and pushes to `main`) triggers the `ci.yml` workflow, which runs `npm run lint`, `npm run test`,
  and `npm run build` on Ubuntu with Node.js 20. Keep the build green before merging.
- Add or adjust tests as you touch parser logic; they are part of `npm test` and therefore block the workflow if they
  fail.

## Packaging & Releases

Semantic-release automates versioning, changelog generation, building, and GitHub Releases:

1. Follow [Conventional Commits](https://www.conventionalcommits.org/) in every merge. The release bot derives the next
   semantic version from these messages.
2. When changes land on `main`, the `release.yml` workflow runs `semantic-release`, which:
   - bumps `package.json`, `package-lock.json`, and `static/manifest.json`,
   - regenerates `CHANGELOG.md`,
   - runs `npm run package` to produce `artifacts/jelu_importer-<version>.zip`,
   - creates a GitHub Release and uploads the ZIP (rename to `.xpi` for manual installs or feed it to AMO for signing).
3. If you need a signed build, run `web-ext sign --api-key <amo-key> --api-secret <amo-secret>` locally or extend the
   release workflow with AMO credentials.

Manual release steps are no longer necessary; push a commit with the right prefix (feat/fix/chore) and let semantic
release handle the rest.

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
