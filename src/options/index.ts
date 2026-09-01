import { getOptions, saveOptions } from '../common/storage';
import { StoredOptions } from '../types/book';

interface TestResult {
  urlValid: boolean;
  urlMessage: string;
  credentialsValid: boolean;
  credentialsMessage: string;
}

class OptionsController {
  private form = document.getElementById('options-form') as HTMLFormElement;
  private status = document.getElementById('save-status') as HTMLElement;
  private testButton = document.getElementById('test-connection') as HTMLButtonElement;
  private testStatus = document.getElementById('test-status') as HTMLElement;
  private authBasicRadio = document.getElementById('auth-basic') as HTMLInputElement;
  private authTokenRadio = document.getElementById('auth-token') as HTMLInputElement;
  private basicAuthFields = document.getElementById('basicAuthFields') as HTMLElement;
  private tokenAuthFields = document.getElementById('tokenAuthFields') as HTMLElement;
  private apiTokenInput = document.getElementById('api-token') as HTMLInputElement;
  private storedToken: string | undefined;

  constructor() {
    this.form?.addEventListener('submit', (event) => this.handleSubmit(event));
    this.testButton?.addEventListener('click', () => this.handleTestConnection());
    this.authBasicRadio?.addEventListener('change', () => this.toggleAuthFields());
    this.authTokenRadio?.addEventListener('change', () => this.toggleAuthFields());
  }

  async init() {
    const options = await getOptions();
    this.populateForm(options);
  }

  private toggleAuthFields() {
    const isBasicAuth = this.authBasicRadio?.checked;

    if (this.basicAuthFields && this.tokenAuthFields) {
      this.basicAuthFields.style.display = isBasicAuth ? 'block' : 'none';
      this.tokenAuthFields.style.display = isBasicAuth ? 'none' : 'block';
    }

    // Update required attributes
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;

    if (usernameInput && passwordInput) {
      usernameInput.required = isBasicAuth;
      passwordInput.required = isBasicAuth;
    }

    // A stored token satisfies the requirement even though the input is left
    // empty (we show placeholder dots instead), so we must not mark it required
    // or native form validation blocks submit before our preserve logic runs
    if (this.apiTokenInput) {
      const hasStoredToken = this.apiTokenInput.dataset.hasToken === 'true';
      this.apiTokenInput.required = !isBasicAuth && !hasStoredToken;
    }
  }

  private populateForm(options: StoredOptions) {
    (document.getElementById('jelu-url') as HTMLInputElement).value = options.jeluUrl;

    // Set auth method radio buttons
    const authMethod = options.authMethod || 'basic';
    if (authMethod === 'token') {
      this.authTokenRadio.checked = true;
    } else {
      this.authBasicRadio.checked = true;
    }

    // Set basic auth fields
    (document.getElementById('username') as HTMLInputElement).value =
      options.username ?? '';
    (document.getElementById('password') as HTMLInputElement).value =
      options.password ?? '';

    // Store the token but show placeholder if it exists
    this.storedToken = options.apiToken;
    if (options.apiToken) {
      this.apiTokenInput.value = '';
      this.apiTokenInput.placeholder = '••••••••••••••••••••••••••••••••••••';
      this.apiTokenInput.dataset.hasToken = 'true';
    } else {
      this.apiTokenInput.placeholder = 'jelu_...';
      delete this.apiTokenInput.dataset.hasToken;
    }

    (document.getElementById('default-tags') as HTMLInputElement).value =
      options.defaultTags.join(', ');
    (document.getElementById('default-add-to-library') as HTMLInputElement).checked =
      options.defaultAddToLibrary ?? false;
    (document.getElementById('enable-logging') as HTMLInputElement).checked =
      options.enableLogging ?? false;

    // Toggle field visibility based on auth method
    this.toggleAuthFields();
  }

  private async handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const data = this.getFormData();

    // Validate token format if using token auth
    if (data.authMethod === 'token' && data.apiToken) {
      if (!this.isValidTokenFormat(data.apiToken)) {
        this.status.textContent =
          "Invalid token format. Token must start with 'jelu_' followed by 32 hexadecimal characters.";
        this.status.className = 'status error';
        setTimeout(() => {
          this.status.textContent = '';
          this.status.className = 'status';
        }, 5000);
        return;
      }
    }

    await saveOptions(data);
    this.status.textContent = 'Settings saved.';
    this.status.className = 'status success';
    setTimeout(() => {
      this.status.textContent = '';
      this.status.className = 'status';
    }, 2500);
  }

  private isValidTokenFormat(token: string): boolean {
    if (!token.startsWith('jelu_')) return false;
    const hexPart = token.slice(5);
    if (hexPart.length !== 32) return false;
    return /^[0-9a-f]+$/.test(hexPart);
  }

  private getFormData(): StoredOptions {
    const defaultTagsInput = (document.getElementById('default-tags') as HTMLInputElement)
      .value;
    const tags = defaultTagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const authMethod = this.authTokenRadio.checked ? 'token' : 'basic';

    const username = (
      document.getElementById('username') as HTMLInputElement
    ).value.trim();
    const password = (document.getElementById('password') as HTMLInputElement).value;

    // Handle API token - preserve existing token if input is empty and token exists
    let apiToken: string | undefined;
    const tokenInputValue = this.apiTokenInput.value.trim();
    if (tokenInputValue) {
      // New token entered
      apiToken = tokenInputValue;
    } else if (this.apiTokenInput.dataset.hasToken === 'true') {
      // No new input, preserve existing token
      apiToken = this.storedToken;
    } else {
      // No token
      apiToken = undefined;
    }

    const defaultAddToLibrary = (
      document.getElementById('default-add-to-library') as HTMLInputElement
    ).checked;
    const enableLogging = (document.getElementById('enable-logging') as HTMLInputElement)
      .checked;

    return {
      jeluUrl: (document.getElementById('jelu-url') as HTMLInputElement).value.trim(),
      authMethod,
      username: username || undefined,
      password: password || undefined,
      apiToken,
      defaultTags: tags,
      defaultAddToLibrary,
      enableLogging,
    };
  }

  private async handleTestConnection() {
    const data = this.getFormData();

    if (!data.jeluUrl) {
      this.showTestStatus('error', 'Please enter a Jelu server URL before testing.');
      return;
    }

    this.testButton.disabled = true;
    this.testButton.textContent = 'Testing...';
    this.hideTestStatus();

    const result = await this.testServerConnection(data);
    this.displayTestResult(result);

    this.testButton.disabled = false;
    this.testButton.textContent = 'Test Server Connection';
  }

  private async testServerConnection(options: StoredOptions): Promise<TestResult> {
    const result: TestResult = {
      urlValid: false,
      urlMessage: '',
      credentialsValid: false,
      credentialsMessage: '',
    };

    const baseUrl = this.normalizeBaseUrl(options.jeluUrl);

    // Test 1: Check if URL is reachable
    try {
      const response = await fetch(`${baseUrl}/api/v1/authors?size=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401 || response.status === 403) {
        // URL is valid, but authentication required
        result.urlValid = true;
        result.urlMessage = 'Server URL is valid and reachable.';
      } else if (response.ok) {
        // URL is valid and no auth required (or public endpoint)
        result.urlValid = true;
        result.urlMessage = 'Server URL is valid and reachable.';
      } else {
        result.urlValid = false;
        result.urlMessage = `Server responded with status ${response.status}. This may not be a valid Jelu server.`;
      }
    } catch (error) {
      result.urlValid = false;
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        result.urlMessage =
          'Cannot reach the server. Check the URL and ensure the server is running.';
      } else {
        result.urlMessage = `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      // If we can't reach the server, skip credential check
      result.credentialsValid = false;
      result.credentialsMessage = 'Cannot test credentials - server is unreachable.';
      return result;
    }

    // Test 2: Check authentication based on method
    if (options.authMethod === 'token') {
      return this.testTokenAuth(baseUrl, options, result);
    } else {
      return this.testBasicAuth(baseUrl, options, result);
    }
  }

  private async testBasicAuth(
    baseUrl: string,
    options: StoredOptions,
    result: TestResult,
  ): Promise<TestResult> {
    if (!options.username || !options.password) {
      result.credentialsValid = false;
      result.credentialsMessage = 'Username and password are required.';
      return result;
    }

    try {
      const encoded = btoa(`${options.username}:${options.password}`);
      const response = await fetch(`${baseUrl}/api/v1/authors?size=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${encoded}`,
        },
      });

      if (response.ok) {
        result.credentialsValid = true;
        result.credentialsMessage = 'Credentials are valid. Authentication successful!';
      } else if (response.status === 401 || response.status === 403) {
        result.credentialsValid = false;
        result.credentialsMessage =
          'Invalid username or password. Please check your credentials.';
      } else {
        result.credentialsValid = false;
        result.credentialsMessage = `Unexpected response (${response.status}). Unable to verify credentials.`;
      }
    } catch (error) {
      result.credentialsValid = false;
      result.credentialsMessage = `Failed to test credentials: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return result;
  }

  private async testTokenAuth(
    baseUrl: string,
    options: StoredOptions,
    result: TestResult,
  ): Promise<TestResult> {
    if (!options.apiToken) {
      result.credentialsValid = false;
      result.credentialsMessage = 'API token is required.';
      return result;
    }

    // Validate token format
    if (!this.isValidTokenFormat(options.apiToken)) {
      result.credentialsValid = false;
      result.credentialsMessage =
        "Invalid token format. Token must start with 'jelu_' followed by 32 hexadecimal characters.";
      return result;
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiToken}`,
    };

    const missingScopes: string[] = [];

    // Test books:read scope
    try {
      const response = await fetch(`${baseUrl}/api/v1/authors?size=1`, { headers });

      if (response.status === 401) {
        result.credentialsValid = false;
        result.credentialsMessage = 'Invalid or expired API token.';
        return result;
      } else if (response.status === 403) {
        missingScopes.push('books:read');
      } else if (!response.ok) {
        result.credentialsValid = false;
        result.credentialsMessage = `Unexpected response (${response.status}). Unable to verify token.`;
        return result;
      }
    } catch (error) {
      result.credentialsValid = false;
      result.credentialsMessage = `Failed to test token: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return result;
    }

    // Report results
    if (missingScopes.length > 0) {
      result.credentialsValid = false;
      result.credentialsMessage = `Token is missing required scope: ${missingScopes.join(', ')}. Autocomplete will not work.`;
    } else {
      result.credentialsValid = true;
      result.credentialsMessage =
        'Token is valid! Note: books:write and reading:write scopes cannot be validated without creating data.';
    }

    return result;
  }

  private displayTestResult(result: TestResult) {
    const allValid = result.urlValid && result.credentialsValid;
    const anyInvalid = !result.urlValid || !result.credentialsValid;

    let statusType: 'success' | 'error' | 'info' = 'info';
    if (allValid) {
      statusType = 'success';
    } else if (anyInvalid) {
      statusType = 'error';
    }

    const messages: string[] = [];

    // URL status
    if (result.urlValid) {
      messages.push(`✓ ${result.urlMessage}`);
    } else {
      messages.push(`✗ ${result.urlMessage}`);
    }

    // Credentials status
    if (result.credentialsValid) {
      messages.push(`✓ ${result.credentialsMessage}`);
    } else {
      messages.push(`✗ ${result.credentialsMessage}`);
    }

    const formattedMessage = messages.map((msg) => `<li>${msg}</li>`).join('');
    this.showTestStatus(
      statusType,
      `<strong>Connection Test Results:</strong><ul>${formattedMessage}</ul>`,
    );
  }

  private showTestStatus(type: 'success' | 'error' | 'info', message: string) {
    this.testStatus.className = `test-status ${type}`;
    this.testStatus.innerHTML = message;
  }

  private hideTestStatus() {
    this.testStatus.className = 'test-status hidden';
    this.testStatus.innerHTML = '';
  }

  private normalizeBaseUrl(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }
}

const controller = new OptionsController();
controller.init();
