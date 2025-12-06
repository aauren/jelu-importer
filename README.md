# Jelu Importer Browser Add-on

Jelu Importer is a Firefox browser extension that scrapes metadata from popular book catalog pages (Goodreads, Amazon Books, Google Books, and Audible) and sends it to a self-hosted Jelu instance. The add-on focuses on giving users a fast, editable preview before import so they can clean up titles, IDs, narrators, and other fields.

## Screenshots

Screenshots will be added once the UI is ready.

- **Popup / Import Flow:** _coming soon_
- **Configuration / Options Page:** _coming soon_

## Installation from Releases

1. Download the latest `.xpi` package from the GitHub Releases page once builds are published.
2. In Firefox, open `about:addons`, select **Install Add-on From File...**, and choose the downloaded `.xpi`.
3. Verify that the add-on appears in the toolbar and pin it if necessary.
4. Open the extension options page to configure your Jelu server URL, port, and authentication details before importing any books.

## Configuration & Authentication

The add-on needs a Jelu URL plus an authentication token. Jelu currently exposes session-style tokens, not long-lived API keys:

1. In your browser, log into your Jelu instance.
2. Use a REST client (or `curl`) to call `GET https://<jelu-host>/api/v1/token`. Provide HTTP basic auth credentials in that request (same login/password you use for the UI). The response is a JSON object such as:

   ```bash
   curl -u you@example.com https://jelu.example.com/api/v1/token
   # => {"token":"3d6c1847-..."}
   ```

3. Copy the `token` value and paste it into the “API Token” field on the extension’s options page. The extension will send it in the `X-Auth-Token` header, matching the official UI’s behavior.
4. If you prefer, you can skip the manual `curl` step and let the add-on store your username/password instead; the extension will authenticate with Jelu using HTTP Basic on each request. Be aware the credentials are stored unencrypted in Firefox local storage.

You can regenerate a token at any time by calling `/api/v1/token` again. The options page also lets you set default tags and choose whether imports should automatically land in your personal library (the popup exposes a matching checkbox so you can override it per book).

## Documentation

- [Architecture & Feature Overview](docs/architecture.md)
- [Development & Automation Guide](docs/development.md)

Additional documents will be added under the `docs/` directory as the project evolves.
