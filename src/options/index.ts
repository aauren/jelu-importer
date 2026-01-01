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

  constructor() {
    this.form?.addEventListener('submit', (event) => this.handleSubmit(event));
    this.testButton?.addEventListener('click', () => this.handleTestConnection());
  }

  async init() {
    const options = await getOptions();
    this.populateForm(options);
  }

  private populateForm(options: StoredOptions) {
    (document.getElementById('jelu-url') as HTMLInputElement).value = options.jeluUrl;
    (document.getElementById('username') as HTMLInputElement).value =
      options.username ?? '';
    (document.getElementById('password') as HTMLInputElement).value =
      options.password ?? '';
    (document.getElementById('default-tags') as HTMLInputElement).value =
      options.defaultTags.join(', ');
    (document.getElementById('default-add-to-library') as HTMLInputElement).checked =
      options.defaultAddToLibrary ?? false;
    (document.getElementById('enable-logging') as HTMLInputElement).checked =
      options.enableLogging ?? false;
  }

  private async handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const data = this.getFormData();
    await saveOptions(data);
    this.status.textContent = 'Settings saved.';
    setTimeout(() => (this.status.textContent = ''), 2500);
  }

  private getFormData(): StoredOptions {
    const defaultTagsInput = (document.getElementById('default-tags') as HTMLInputElement)
      .value;
    const tags = defaultTagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const username = (
      document.getElementById('username') as HTMLInputElement
    ).value.trim();
    const password = (document.getElementById('password') as HTMLInputElement).value;
    const defaultAddToLibrary = (
      document.getElementById('default-add-to-library') as HTMLInputElement
    ).checked;
    const enableLogging = (document.getElementById('enable-logging') as HTMLInputElement)
      .checked;

    return {
      jeluUrl: (document.getElementById('jelu-url') as HTMLInputElement).value.trim(),
      username: username || undefined,
      password: password || undefined,
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

    // Test 2: Check credentials
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
