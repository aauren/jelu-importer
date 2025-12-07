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
    (document.getElementById('username') as HTMLInputElement).value = options.username ?? '';
    (document.getElementById('password') as HTMLInputElement).value = options.password ?? '';
    (document.getElementById('default-tags') as HTMLInputElement).value = options.defaultTags.join(
      ', ',
    );
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
    const defaultTagsInput = (document.getElementById('default-tags') as HTMLInputElement).value;
    const tags = defaultTagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const username = (document.getElementById('username') as HTMLInputElement).value.trim();
    const password = (document.getElementById('password') as HTMLInputElement).value;
    const defaultAddToLibrary = (
      document.getElementById('default-add-to-library') as HTMLInputElement
    ).checked;
    const enableLogging = (document.getElementById('enable-logging') as HTMLInputElement).checked;

    return {
      jeluUrl: (document.getElementById('jelu-url') as HTMLInputElement).value.trim(),
      username: username || undefined,
      password: password || undefined,
      defaultTags: tags,
      defaultAddToLibrary,
      enableLogging,
    };
  }
}

const controller = new OptionsController();
controller.init();
