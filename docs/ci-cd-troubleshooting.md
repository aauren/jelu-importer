# CI/CD Troubleshooting Guide

This guide helps you diagnose and fix common issues with the GitHub Actions workflows.

## Table of Contents

- [Workflow Overview](#workflow-overview)
- [Common Issues](#common-issues)
  - [CI Workflow Issues](#ci-workflow-issues)
  - [Release Workflow Issues](#release-workflow-issues)
  - [Firefox Publishing Issues](#firefox-publishing-issues)
  - [Chrome Publishing Issues](#chrome-publishing-issues)
- [Debugging Steps](#debugging-steps)
- [Manual Recovery](#manual-recovery)

---

## Workflow Overview

### CI Workflow (Pull Requests)

```
lint → \
test  → → build
typecheck → /
```

**All must pass before build runs.**

### Release Workflow (Main Branch)

```
lint → \
test  → → build → release-and-package → publish-firefox (parallel)
typecheck → /                        → publish-chrome  (parallel)
```

**Publishing only happens if semantic-release creates a new release.**

---

## Common Issues

### CI Workflow Issues

#### ❌ Lint Job Fails

**Symptom:** Lint job shows red X, ESLint errors in logs

**Cause:** Code style violations or ESLint configuration issues

**Fix:**

```bash
# Run lint locally to see errors
npm run lint

# Auto-fix most issues
npm run lint -- --fix

# Commit the fixes
git add .
git commit -m "fix: resolve linting issues"
```

#### ❌ TypeCheck Job Fails

**Symptom:** TypeCheck job shows red X, TypeScript errors in logs

**Cause:** Type mismatches or missing type definitions

**Fix:**

```bash
# Run typecheck locally
npm run typecheck

# Review errors and fix type issues
# Common fixes:
# - Add missing type annotations
# - Fix incorrect return types
# - Ensure imports have proper types
```

**Common TypeScript Errors:**

| Error                                        | Fix                                   |
| -------------------------------------------- | ------------------------------------- |
| `Cannot find module 'webextension-polyfill'` | Pre-existing issue, safe to ignore    |
| `Property 'x' does not exist on type 'Y'`    | Add the property or fix the type      |
| `Type 'X' is not assignable to type 'Y'`     | Adjust types to match expected values |

#### ❌ Test Job Fails

**Symptom:** Test job shows red X, Jest test failures in logs

**Cause:** Failing unit tests or test configuration issues

**Fix:**

```bash
# Run tests locally
npm test

# Run specific test file
npm test -- amazon.parser.test.ts

# Update snapshots if needed
npm test -- -u
```

#### ❌ Build Job Fails

**Symptom:** Build job shows red X, occurs after lint/test/typecheck pass

**Cause:** Build configuration issues or esbuild errors

**Fix:**

```bash
# Run build locally
npm run build

# Check for build errors
# Common issues:
# - Missing dependencies
# - Syntax errors
# - Import path issues
```

**Note:** Build job only runs if lint, typecheck, and test all pass.

---

### Release Workflow Issues

#### ⚠️ No Release Created

**Symptom:**

- lint, test, typecheck, build all pass ✅
- release-and-package shows "No release published" ⏭️
- publish-firefox and publish-chrome skipped ⏭️

**Cause:** Semantic-release didn't find commits that warrant a release

**This is expected behavior when:**

- Commits don't follow conventional commit format
- Only docs/README changes
- Commits with `[skip ci]` in message
- No `feat:` or `fix:` commits since last release

**Fix (if you want to force a release):**

```bash
# Add a commit that triggers a release
git commit --allow-empty -m "fix: trigger release"
git push origin main
```

**Conventional Commit Format:**

- `feat: add new feature` → Minor version bump (1.5.0 → 1.6.0)
- `fix: resolve bug` → Patch version bump (1.5.0 → 1.5.1)
- `feat!: breaking change` → Major version bump (1.5.0 → 2.0.0)
- `docs: update README` → No release
- `chore: update dependencies` → No release

#### ❌ Semantic Release Fails

**Symptom:** release-and-package job fails with semantic-release error

**Common Errors:**

**1. "ENOGHTOKEN"**

```
Error: The GITHUB_TOKEN environment variable must be defined
```

**Fix:**

- This shouldn't happen (GitHub provides this automatically)
- Check workflow permissions in release.yml
- Verify `permissions: contents: write` is set

**2. "EINVALIDNEXTVERSION"**

```
Error: The next release version is invalid
```

**Fix:**

- Check if version in manifests/base.json was manually changed
- Ensure semantic-release has full git history
- Verify fetch-depth: 0 in checkout step

**3. "Git authentication failed"**

```
Error: Command failed: git push
```

**Fix:**

- Verify `permissions: contents: write` in workflow
- Check branch protection rules don't block bot commits

#### ❌ Package Step Fails

**Symptom:** Error during "Package Extensions" step

**Cause:** web-ext build failures or missing artifacts

**Fix:**

```bash
# Test packaging locally
npm run package

# Check artifacts are created
ls artifacts/firefox/
ls artifacts/chrome/

# Verify web-ext is installed
npx web-ext --version
```

#### ❌ Artifact Upload/Download Fails

**Symptom:** "Artifact not found" or "Download failed"

**Cause:** Artifact wasn't created or name mismatch

**Fix:**

1. Check previous job completed successfully
2. Verify artifact name matches in upload/download steps
3. Check artifact retention period (90 days)

**Artifact Flow:**

```
build job:
  → uploads "built-extension" (dist/, dist-chrome/)

release-and-package job:
  → downloads "built-extension"
  → uploads "packaged-firefox" (artifacts/firefox/*.zip)
  → uploads "packaged-chrome" (artifacts/chrome/*.zip)

publish-firefox job:
  → downloads "packaged-firefox"

publish-chrome job:
  → downloads "packaged-chrome"
```

---

### Firefox Publishing Issues

#### ❌ AMO Signing Fails

**Symptom:** publish-firefox job fails, error from web-ext sign

**Common Errors:**

**1. "Authentication failed"**

```
Error: Authentication with AMO failed (401)
```

**Fix:**

- Verify `AMO_ISSUER` and `AMO_SECRET` secrets are correct
- Regenerate AMO API credentials if needed
- Check credentials at: https://addons.mozilla.org/developers/addon/api/key/

**2. "Validation failed"**

```
Error: Validation failed for manifest
```

**Fix:**

- Check manifest.json is valid for Firefox
- Run local validation:
  ```bash
  npx web-ext lint --source-dir dist
  ```
- Review error messages and fix manifest issues

**3. "Version already exists"**

```
Error: Version X.Y.Z already exists
```

**Fix:**

- This shouldn't happen with semantic-release
- Verify manifests/base.json version is being updated
- Check semantic-release committed the version bump

#### ❌ Can't Attach XPI to Release

**Symptom:** Signing succeeds but attaching to GitHub release fails

**Cause:** Missing gh CLI authentication or release doesn't exist

**Fix:**

1. Verify GITHUB_TOKEN is passed to the step
2. Check the release was created by semantic-release
3. Verify version tag exists:
   ```bash
   git tag -l "v*"
   ```

---

### Chrome Publishing Issues

#### ⚠️ Chrome Upload Fails (Warning)

**Symptom:** publish-chrome job shows warning but workflow succeeds

**Note:** Chrome publishing uses `continue-on-error: true`, so failures warn but don't fail the workflow.

**Common Errors:**

**1. "Invalid client credentials"**

```
Error: Authentication failed (401)
```

**Fix:**

- Verify `CHROME_CLIENT_ID` and `CHROME_CLIENT_SECRET` secrets
- Check OAuth credentials in Google Cloud Console
- Regenerate if needed (see chrome-webstore-setup.md)

**2. "Invalid refresh token"**

```
Error: Invalid refresh token (401)
```

**Fix:**

- Refresh token may have been revoked
- Regenerate refresh token:
  1. Go to OAuth 2.0 Playground
  2. Follow steps in chrome-webstore-setup.md Step 4
  3. Update `CHROME_REFRESH_TOKEN` secret

**3. "Extension not found"**

```
Error: Item not found (404)
```

**Fix:**

- Verify `CHROME_EXTENSION_ID` is correct
- Check Chrome Web Store URL: https://chromewebstore.google.com/detail/jelu-importer/elfmiakdnfjpdmhmkkbcnblkgdbfmdad
- Extension ID should be: `elfmiakdnfjpdmhmkkbcnblkgdbfmdad`

**4. "Package is invalid"**

```
Error: Package is invalid
```

**Fix:**

- Check manifest.json is valid for Chrome
- Verify all required fields are present
- Test package locally:
  ```bash
  chrome-webstore-upload-cli upload \
    --source artifacts/chrome/*.zip \
    --extension-id ... \
    --auto-publish=false
  ```

**5. "Version already exists"**

```
Error: Version X.Y.Z already published
```

**Fix:**

- Chrome Web Store already has this version
- Semantic-release should prevent this
- Check manifests/base.json version was incremented

**6. "Upload succeeded but publish pending review"**

```
Upload successful, but item is pending review
```

**Fix:**

- This is normal! Chrome Web Store requires review
- Extension will auto-publish after review (1-3 days typically)
- Track status: https://chrome.google.com/webstore/devconsole/

---

## Debugging Steps

### Step 1: Check Workflow Logs

1. Go to GitHub repository → Actions tab
2. Click on the failed workflow run
3. Click on the failed job
4. Expand the failed step to see detailed logs

### Step 2: Reproduce Locally

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm ci

# Run the same commands as CI
npm run lint
npm run typecheck
npm test
npm run build
npm run package
```

### Step 3: Check Secrets

1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Verify all required secrets exist:
   - `AMO_ISSUER`
   - `AMO_SECRET`
   - `CHROME_EXTENSION_ID`
   - `CHROME_CLIENT_ID`
   - `CHROME_CLIENT_SECRET`
   - `CHROME_REFRESH_TOKEN`

**Note:** You can't view secret values, only update them.

### Step 4: Check Git History

```bash
# Check recent commits
git log --oneline -10

# Check tags
git tag -l "v*"

# Check what semantic-release would do
npx semantic-release --dry-run --no-ci
```

### Step 5: Verify Manifest Versions

```bash
# Check current version
cat package.json | grep version
cat manifests/base.json | grep version

# After build, check generated manifests
cat dist/manifest.json | grep version
cat dist-chrome/manifest.json | grep version
```

---

## Manual Recovery

### Retry Failed Publishing

If only publishing failed (Firefox or Chrome), you can manually retry:

**Option 1: Manual Workflow Trigger**

1. Go to Actions → Release workflow
2. Click "Run workflow"
3. Select branch (main)
4. Click "Run workflow"

**Option 2: Manual Firefox Upload**

1. Build and package locally: `npm run package`
2. Upload to AMO: https://addons.mozilla.org/developers/

**Option 3: Manual Chrome Upload**

1. Build and package locally: `npm run package`
2. Upload to Chrome Web Store: https://chrome.google.com/webstore/devconsole/

### Fix Version Mismatch

If semantic-release committed wrong version:

```bash
# Revert the commit
git revert HEAD
git push origin main

# Or fix manually
# 1. Update manifests/base.json version
# 2. Commit with conventional commit message
git add manifests/base.json
git commit -m "fix: correct version number"
git push origin main
```

### Regenerate OAuth Credentials

If Chrome publishing consistently fails:

1. Follow chrome-webstore-setup.md completely
2. Generate new Client ID, Client Secret, Refresh Token
3. Update all GitHub secrets
4. Test locally before pushing

---

## Getting Help

If you're still stuck:

1. **Check workflow logs** for detailed error messages
2. **Search GitHub Issues** for similar problems
3. **Review recent changes** that might have broken the workflow
4. **Test locally** to isolate the issue
5. **Check external services**:
   - AMO status: https://addons.mozilla.org/
   - Chrome Web Store status: https://chrome.google.com/webstore/devconsole/
   - GitHub Actions status: https://www.githubstatus.com/

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Release Documentation](https://semantic-release.gitbook.io/)
- [web-ext Documentation](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/using_webstore_api)
- [AMO API Documentation](https://addons-server.readthedocs.io/en/latest/topics/api/signing.html)
