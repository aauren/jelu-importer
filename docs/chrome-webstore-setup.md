# Chrome Web Store Publishing Setup

This guide walks you through setting up automatic publishing to the Chrome Web Store via GitHub Actions.

## Prerequisites

- Google Account that owns the Chrome extension
- Extension already published: [Jelu Importer on Chrome Web Store](https://chromewebstore.google.com/detail/jelu-importer/elfmiakdnfjpdmhmkkbcnblkgdbfmdad)
- 2-step verification enabled on your Google Account
- Access to the GitHub repository settings

## One-Time Setup Process

### Step 1: Enable Chrome Web Store API

1. Go to [Google Cloud Console](https://console.developers.google.com)
2. Create a new project or select an existing one
   - Click "Select a project" dropdown at the top
   - Click "New Project"
   - Project name: "Jelu Importer CI/CD" (or your preferred name)
   - Click "Create"
3. In the search bar at the top, type "Chrome Web Store API"
4. Click on "Chrome Web Store API" in the results
5. Click "Enable"

### Step 2: Configure OAuth Consent Screen

1. In the left sidebar, navigate to "OAuth consent screen"
2. Select "External" as the User Type
3. Click "Create"
4. Fill in the required fields:
   - **App name:** "Jelu Importer GitHub Actions"
   - **User support email:** Your email address
   - **Developer contact information:** Your email address
5. Click "Save and Continue"
6. On the Scopes screen, click "Save and Continue" (no changes needed)
7. On the Test users screen:
   - Click "Add Users"
   - Enter your email address (the one that owns the Chrome extension)
   - Click "Add"
   - Click "Save and Continue"
8. Review the summary and click "Back to Dashboard"

### Step 3: Create OAuth Client ID

1. In the left sidebar, navigate to "Credentials"
2. Click "Create Credentials" at the top
3. Select "OAuth client ID"
4. Configure the OAuth client:
   - **Application type:** Web application
   - **Name:** "Jelu Importer GitHub Actions"
   - **Authorized redirect URIs:**
     - Click "Add URI"
     - Enter: `https://developers.google.com/oauthplayground`
     - Press Enter
5. Click "Create"
6. A dialog will appear with your credentials - **SAVE THESE VALUES:**
   - **Client ID** (looks like: `123456789-abc123xyz.apps.googleusercontent.com`)
   - **Client Secret** (looks like: `GOCSPX-abc123def456`)
7. Click "OK" to close the dialog

> **Important:** Keep these credentials secure. Do not commit them to git or share them publicly.

### Step 4: Generate Refresh Token

1. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) in a new tab
2. Click the **Settings icon (⚙️)** in the top-right corner
3. Check the box "Use your own OAuth credentials"
4. Enter your credentials from Step 3:
   - **OAuth Client ID:** Paste your Client ID
   - **OAuth Client secret:** Paste your Client Secret
5. Click anywhere outside the settings panel to close it
6. In the left panel under "Step 1", find the input field labeled "Input your own scopes"
7. Enter the following scope:
   ```
   https://www.googleapis.com/auth/chromewebstore
   ```
8. Click "Authorize APIs"
9. **Sign in with your Google Account** (the one that owns the Chrome extension)
   - If prompted to choose an account, select the account that owns the extension
10. Google will show a warning: "Google hasn't verified this app"
    - Click "Advanced"
    - Click "Go to Jelu Importer GitHub Actions (unsafe)"
    - This is safe - it's your own app
11. Review the permissions and click "Allow"
12. You'll be redirected back to OAuth Playground
13. Click "Exchange authorization code for tokens"
14. **SAVE THIS VALUE:**
    - **Refresh token** (starts with `1/` and is a long string)
    - This token doesn't expire unless you revoke it

> **Important:** The refresh token is sensitive. Keep it secure and never commit it to git.

### Step 5: Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click "New repository secret"
4. Add each of the following secrets (one at a time):

| Secret Name            | Value                                     | Where to Find        |
| ---------------------- | ----------------------------------------- | -------------------- |
| `CHROME_EXTENSION_ID`  | `elfmiakdnfjpdmhmkkbcnblkgdbfmdad`        | Chrome Web Store URL |
| `CHROME_CLIENT_ID`     | `123456789-...apps.googleusercontent.com` | From Step 3          |
| `CHROME_CLIENT_SECRET` | `GOCSPX-...`                              | From Step 3          |
| `CHROME_REFRESH_TOKEN` | `1/...`                                   | From Step 4          |

**To add each secret:**

1. Click "New repository secret"
2. Enter the **Name** exactly as shown above (case-sensitive)
3. Paste the **Value**
4. Click "Add secret"
5. Repeat for all four secrets

### Step 6: Verify Setup

Once all secrets are added, you should see them listed in the repository secrets page:

```
CHROME_EXTENSION_ID
CHROME_CLIENT_ID
CHROME_CLIENT_SECRET
CHROME_REFRESH_TOKEN
AMO_ISSUER (existing)
AMO_SECRET (existing)
```

## Testing the Setup

### Option 1: Test Locally (Recommended)

Before pushing to GitHub, test the Chrome Web Store upload locally:

1. Install the chrome-webstore-upload-cli tool:

   ```bash
   npm install -g chrome-webstore-upload-cli
   ```

2. Build and package your extension:

   ```bash
   npm run build
   npm run package:chrome
   ```

3. Test the upload (without auto-publish):

   ```bash
   chrome-webstore-upload-cli upload \
     --source artifacts/chrome/*.zip \
     --extension-id YOUR_EXTENSION_ID \
     --client-id YOUR_CLIENT_ID \
     --client-secret YOUR_CLIENT_SECRET \
     --refresh-token YOUR_REFRESH_TOKEN \
     --auto-publish=false
   ```

4. If successful, you'll see: "Successfully uploaded the extension"

### Option 2: Test via GitHub Actions

1. Make a commit to the `main` branch (ensure it triggers a semantic release)
2. Go to the **Actions** tab in your GitHub repository
3. Watch the release workflow run
4. Check that all jobs complete successfully:
   - ✅ lint, typecheck, test (parallel)
   - ✅ build
   - ✅ release-and-package
   - ✅ publish-firefox
   - ✅ publish-chrome

5. Verify the Chrome Web Store Developer Dashboard shows the new version

## Understanding the Publishing Process

### Workflow Behavior

1. **When a release is created** (via semantic-release):
   - The extension is automatically uploaded to Chrome Web Store
   - It's submitted for review with the `--auto-publish` flag
   - Review typically takes 1-3 days (sometimes instant for minor updates)
   - Once approved, it publishes automatically

2. **If Chrome upload fails:**
   - The workflow continues (doesn't block Firefox publishing)
   - A warning is shown in the GitHub Actions log
   - You can manually upload from the Chrome Web Store Developer Dashboard
   - Or manually trigger the workflow again

3. **Version management:**
   - The version in `manifests/base.json` must be higher than the current published version
   - Semantic-release handles this automatically

### Chrome Web Store Review

After upload, the extension goes through Chrome Web Store review:

- **First submission:** Usually takes 1-3 days
- **Subsequent updates:** Can be instant or take up to 3 days
- **Eligibility for fast-track:** Some updates skip review (see [Chrome Web Store docs](https://developer.chrome.com/docs/webstore/skip-review))

You can track review status at:

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)

## Troubleshooting

### "Invalid client ID or secret"

- Double-check the `CHROME_CLIENT_ID` and `CHROME_CLIENT_SECRET` secrets
- Ensure you copied the full values without extra spaces
- Verify the OAuth client exists in Google Cloud Console

### "Invalid refresh token"

- The refresh token may have been revoked
- Regenerate it using Step 4 above
- Update the `CHROME_REFRESH_TOKEN` secret in GitHub

### "Extension not found"

- Verify `CHROME_EXTENSION_ID` matches your published extension
- Check the Chrome Web Store URL to confirm the ID

### "Version already exists"

- The version in `manifests/base.json` must be higher than the published version
- Semantic-release should handle this automatically
- Check that semantic-release is creating a new version

### "Upload succeeds but publish fails"

- Check the Chrome Web Store Developer Dashboard for review status
- Some updates require manual review before publishing
- Extension will publish automatically after review passes

## Revoking Access

If you need to revoke access:

1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find "Jelu Importer GitHub Actions"
3. Click "Remove Access"

To restore access, regenerate the refresh token using Step 4.

## Security Notes

- ✅ Refresh tokens don't expire but can be revoked
- ✅ GitHub encrypts repository secrets
- ✅ These credentials only have permission to upload to your specific extension
- ✅ The OAuth client is restricted to the Chrome Web Store API scope
- ⚠️ Never commit credentials to git
- ⚠️ Never share your Client Secret or Refresh Token publicly

## Additional Resources

- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/using_webstore_api)
- [chrome-webstore-upload-cli Documentation](https://github.com/fregante/chrome-webstore-upload-cli)
- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
