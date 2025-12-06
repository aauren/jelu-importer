import { getOptions, saveOptions } from '../common/storage';
import { StoredOptions } from '../types/book';

class OptionsController {
  private form = document.getElementById('options-form') as HTMLFormElement;
  private status = document.getElementById('save-status') as HTMLElement;

  constructor() {
    this.form?.addEventListener('submit', (event) => this.handleSubmit(event));
  }

  async init() {
    const options = await getOptions();
    this.populateForm(options);
  }

  private populateForm(options: StoredOptions) {
    (document.getElementById('jelu-url') as HTMLInputElement).value = options.jeluUrl;
    (document.getElementById('api-token') as HTMLInputElement).value = options.apiToken ?? '';
    (document.getElementById('username') as HTMLInputElement).value = options.username ?? '';
    (document.getElementById('password') as HTMLInputElement).value = options.password ?? '';
    (document.getElementById('default-tags') as HTMLInputElement).value = options.defaultTags.join(
      ', ',
    );
    (document.getElementById('default-add-to-library') as HTMLInputElement).checked =
      options.defaultAddToLibrary ?? false;
  }

  private async handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const data = this.getFormData();
    await saveOptions(data);
    this.status.textContent = 'Settings saved.';
    setTimeout(() => (this.status.textContent = ''), 2500);
  }

  private getFormData(): StoredOptions {
    const defaultTagsInput = (document.getElementById('default-tags') as HTMLInputElement).value;
    const tags = defaultTagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const apiToken = (document.getElementById('api-token') as HTMLInputElement).value.trim();
    const username = (document.getElementById('username') as HTMLInputElement).value.trim();
    const password = (document.getElementById('password') as HTMLInputElement).value;
    const defaultAddToLibrary = (
      document.getElementById('default-add-to-library') as HTMLInputElement
    ).checked;

    const authStrategy = apiToken ? 'token' : 'password';

    return {
      jeluUrl: (document.getElementById('jelu-url') as HTMLInputElement).value.trim(),
      apiToken: apiToken || undefined,
      username: username || undefined,
      password: password || undefined,
      defaultTags: tags,
      authStrategy,
      defaultAddToLibrary,
    };
  }
}

const controller = new OptionsController();
controller.init();
