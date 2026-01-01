import browser from 'webextension-polyfill';
import { BookImportPayload, ScrapedBook, StoredOptions } from '../types/book';
import { getOptions } from '../common/storage';
import { AutocompleteService } from '../common/autocomplete';
import { AutocompleteController } from './autocomplete';

function csvToArray(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function arrayToCsv(values?: string[]): string {
  return (values ?? []).join(', ');
}

function mergeTags(userInput: string[], defaults: string[]): string[] {
  const seen = new Set<string>();
  const combined = [...userInput, ...defaults];
  combined.forEach((tag) => {
    if (tag) {
      seen.add(tag);
    }
  });
  return Array.from(seen);
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

class DatePicker {
  private input: HTMLInputElement;
  private toggleBtn: HTMLButtonElement;
  private container: HTMLElement;
  private monthLabel: HTMLElement;
  private yearSelect: HTMLSelectElement;
  private grid: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private visible = false;
  private cursor = new Date();

  constructor(
    inputId: string,
    toggleBtnId: string,
    containerId: string,
    monthLabelId: string,
    yearSelectId: string,
    gridId: string,
    prevBtnId: string,
    nextBtnId: string,
  ) {
    this.input = document.getElementById(inputId) as HTMLInputElement;
    this.toggleBtn = document.getElementById(toggleBtnId) as HTMLButtonElement;
    this.container = document.getElementById(containerId) as HTMLElement;
    this.monthLabel = document.getElementById(monthLabelId) as HTMLElement;
    this.yearSelect = document.getElementById(yearSelectId) as HTMLSelectElement;
    this.grid = document.getElementById(gridId) as HTMLElement;
    this.prevBtn = document.getElementById(prevBtnId) as HTMLButtonElement;
    this.nextBtn = document.getElementById(nextBtnId) as HTMLButtonElement;

    this.toggleBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      this.toggle(!this.visible);
    });
    this.prevBtn?.addEventListener('click', () => this.shiftMonth(-1));
    this.nextBtn?.addEventListener('click', () => this.shiftMonth(1));
    this.yearSelect?.addEventListener('change', () => this.handleYearSelect());
    this.input?.addEventListener('input', () => this.syncCursor());
  }

  toggle(show: boolean = !this.visible) {
    if (!this.container) {
      return;
    }
    this.visible = show;
    this.container.classList.toggle('hidden', !show);
    if (show) {
      this.render();
    }
  }

  hide() {
    this.toggle(false);
  }

  isVisible(): boolean {
    return this.visible;
  }

  contains(element: HTMLElement): boolean {
    return this.container?.contains(element) || this.toggleBtn?.contains(element);
  }

  private shiftMonth(delta: number) {
    this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + delta, 1);
    this.render();
  }

  private handleYearSelect() {
    if (!this.yearSelect) {
      return;
    }
    const year = Number(this.yearSelect.value);
    if (!Number.isFinite(year)) {
      return;
    }
    this.cursor = new Date(year, this.cursor.getMonth(), 1);
    this.render();
  }

  private syncCursor() {
    const parsed = this.parseDate(this.input?.value);
    if (parsed) {
      this.cursor = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    }
  }

  render() {
    if (!this.grid || !this.monthLabel || !this.input) {
      return;
    }
    const base = new Date(this.cursor.getFullYear(), this.cursor.getMonth(), 1);
    const locale = navigator.language || 'en-US';
    this.monthLabel.textContent = base.toLocaleDateString(locale, {
      month: 'long',
    });
    this.buildYearOptions(base.getFullYear());
    const currentValue = this.input.value;
    const currentParsed = this.parseDate(currentValue);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const firstDay = base.getDay();

    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    this.grid.textContent = '';

    weekdays.forEach((day) => {
      const div = document.createElement('div');
      div.className = 'weekday';
      div.textContent = day;
      this.grid.append(div);
    });

    for (let i = 0; i < firstDay; i += 1) {
      const spacer = document.createElement('div');
      spacer.className = 'empty';
      this.grid.append(spacer);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(base.getFullYear(), base.getMonth(), day);
      const formatted = this.formatDate(date);
      const isCurrent = currentParsed
        ? date.toDateString() === currentParsed.toDateString()
        : false;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.date = formatted;
      button.dataset.current = String(isCurrent);
      button.textContent = String(day);
      this.grid.append(button);
    }

    Array.from(this.grid.querySelectorAll('button[data-date]')).forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.getAttribute('data-date');
        if (value && this.input) {
          this.input.value = value;
          this.toggle(false);
        }
      });
    });
  }

  private parseDate(value?: string): Date | null {
    if (!value) {
      return null;
    }
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) {
      return null;
    }
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  private formatDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, '0');
    const dd = `${date.getDate()}`.padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private buildYearOptions(selectedYear: number) {
    if (!this.yearSelect) {
      return;
    }
    const nowYear = new Date().getFullYear();
    const range = 40;
    const minYear = Math.max(1900, Math.min(selectedYear, nowYear) - range);
    const maxYear = Math.max(selectedYear, nowYear) + 2;
    this.yearSelect.textContent = '';
    for (let year = minYear; year <= maxYear; year += 1) {
      const option = document.createElement('option');
      option.value = String(year);
      option.selected = year === selectedYear;
      option.textContent = String(year);
      this.yearSelect.append(option);
    }
    this.yearSelect.value = String(selectedYear);
  }
}

class PopupController {
  private statusEl = document.getElementById('status') as HTMLElement;
  private editorEl = document.getElementById('editor') as HTMLElement;
  private form = document.getElementById('import-form') as HTMLFormElement;
  private addToLibraryInput = document.getElementById(
    'add-to-library',
  ) as HTMLInputElement;
  private markFinishedInput = document.getElementById(
    'mark-finished',
  ) as HTMLInputElement;
  private finishedDateWrapper = document.getElementById(
    'finished-date-wrapper',
  ) as HTMLElement;
  private finishedDateInput = document.getElementById(
    'finished-date',
  ) as HTMLInputElement;
  private coverPreviewImage = document.getElementById(
    'cover-preview-image',
  ) as HTMLImageElement | null;
  private coverPreviewPlaceholder = document.getElementById(
    'cover-preview-placeholder',
  ) as HTMLElement | null;
  private importStatusEl = document.getElementById('import-status') as HTMLElement;
  private spinnerEl = document.getElementById('submit-spinner') as HTMLElement;
  private book: ScrapedBook | null = null;
  private options: StoredOptions | null = null;
  private finishedDatePicker: DatePicker;
  private publishDatePicker: DatePicker;
  private autocompleteService: AutocompleteService | null = null;
  private autocompleteControllers: AutocompleteController[] = [];

  constructor() {
    this.finishedDatePicker = new DatePicker(
      'finished-date',
      'finished-date-picker',
      'finished-date-calendar',
      'calendar-month',
      'calendar-year',
      'calendar-grid',
      'calendar-prev',
      'calendar-next',
    );
    this.publishDatePicker = new DatePicker(
      'publish-date',
      'publish-date-picker',
      'publish-date-calendar',
      'publish-calendar-month',
      'publish-calendar-year',
      'publish-calendar-grid',
      'publish-calendar-prev',
      'publish-calendar-next',
    );
    this.form?.addEventListener('submit', (event) => this.handleSubmit(event));
    this.markFinishedInput?.addEventListener('change', () => this.handleFinishedToggle());
    document.addEventListener('mousedown', (event) => this.handleCalendarBlur(event));
  }

  private setStatus(message: string, tone: 'info' | 'error' = 'info') {
    this.statusEl.textContent = message;
    this.statusEl.dataset.tone = tone;
  }

  async init() {
    this.setStatus('Loading options...');
    this.options = await getOptions();
    if (!this.options.jeluUrl) {
      this.setStatus('Configure your Jelu server URL in the options page.', 'error');
      return;
    }

    const tab = await getActiveTab();
    if (!tab?.id) {
      this.setStatus('No active tab detected.', 'error');
      return;
    }

    this.setStatus('Reading book data...');
    try {
      const scraped = (await browser.tabs.sendMessage(tab.id, {
        type: 'SCRAPE_PAGE',
      })) as ScrapedBook | null;

      if (!scraped) {
        this.setStatus('This page is not supported or no book data was found.', 'error');
        return;
      }
      this.book = scraped;
      this.populateForm(scraped);
      this.initAutocomplete();
      this.editorEl.classList.remove('hidden');
      this.setStatus('Review the data and send it to Jelu.');
    } catch (error) {
      console.error('Failed to scrape page', error);
      this.setStatus('Could not gather book information from this page.', 'error');
    }
  }

  private initAutocomplete() {
    // Check if Jelu is configured with credentials
    if (!this.options?.jeluUrl || !this.options?.username || !this.options?.password) {
      // Silently skip autocomplete if not configured
      return;
    }

    this.autocompleteService = new AutocompleteService(this.options);

    // Define fields with their fetch functions
    const fields = [
      {
        id: 'book-authors',
        fetch: (q: string) => this.autocompleteService!.fetchAuthors(q),
      },
      {
        id: 'book-narrators',
        fetch: (q: string) => this.autocompleteService!.fetchAuthors(q, 'NARRATOR'),
      },
      {
        id: 'book-tags',
        fetch: (q: string) => this.autocompleteService!.fetchTags(q),
      },
      {
        id: 'series-name',
        fetch: (q: string) => this.autocompleteService!.fetchSeries(q),
      },
      {
        id: 'publisher',
        fetch: (q: string) => this.autocompleteService!.fetchPublishers(q),
      },
    ];

    // Attach autocomplete to each field
    for (const field of fields) {
      const input = document.getElementById(field.id) as HTMLInputElement;
      if (input) {
        const controller = new AutocompleteController(input, field.fetch);
        controller.attach();
        this.autocompleteControllers.push(controller);
      }
    }
  }

  private populateForm(book: ScrapedBook) {
    (document.getElementById('book-title') as HTMLInputElement).value = book.title;
    (document.getElementById('book-authors') as HTMLInputElement).value = arrayToCsv(
      book.authors,
    );
    (document.getElementById('book-narrators') as HTMLInputElement).value = arrayToCsv(
      book.narrators,
    );
    (document.getElementById('book-tags') as HTMLInputElement).value = arrayToCsv(
      book.tags,
    );
    (document.getElementById('series-name') as HTMLInputElement).value =
      book.series?.name ?? '';
    (document.getElementById('series-number') as HTMLInputElement).value =
      book.series?.number ?? '';
    (document.getElementById('publisher') as HTMLInputElement).value =
      book.publisher ?? '';
    (document.getElementById('publish-date') as HTMLInputElement).value =
      book.publishDate ?? '';
    (document.getElementById('page-count') as HTMLInputElement).value =
      book.pageCount?.toString() ?? '';
    (document.getElementById('description') as HTMLTextAreaElement).value =
      book.description ?? '';

    (document.getElementById('isbn10') as HTMLInputElement).value =
      book.identifiers.isbn10 ?? '';
    (document.getElementById('isbn13') as HTMLInputElement).value =
      book.identifiers.isbn13 ?? '';
    (document.getElementById('asin') as HTMLInputElement).value =
      book.identifiers.asin ?? '';
    (document.getElementById('goodreadsId') as HTMLInputElement).value =
      book.identifiers.goodreadsId ?? '';
    (document.getElementById('amazonId') as HTMLInputElement).value =
      book.identifiers.amazonId ?? '';
    this.addToLibraryInput.checked = this.options?.defaultAddToLibrary ?? false;
    if (this.markFinishedInput) {
      this.markFinishedInput.checked = false;
    }
    if (this.finishedDateInput) {
      this.finishedDateInput.value = '';
    }
    this.updateFinishedDateVisibility();
    this.finishedDatePicker.render();
    this.publishDatePicker.render();
    this.setImportStatus('');
    this.updateCoverPreview(book.coverImage);
  }

  private async handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!this.book || !this.options) {
      this.setStatus('Nothing to import yet.', 'error');
      return;
    }
    const submitBtn = this.form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    submitBtn.disabled = true;
    this.setImportStatus('Sending to Jelu...');
    this.toggleSpinner(true);

    const payload = this.buildPayload();

    try {
      await browser.runtime.sendMessage({
        type: 'IMPORT_BOOK',
        payload,
      });
      this.setImportStatus('Import completed successfully.', 'success');
    } catch (error) {
      console.error('Import failed', error);
      this.setImportStatus('Import failed. Check logs for details.', 'error');
    } finally {
      submitBtn.disabled = false;
      this.toggleSpinner(false);
    }
  }

  private buildPayload(): BookImportPayload {
    const titleInput = document.getElementById('book-title') as HTMLInputElement;
    const authorsInput = document.getElementById('book-authors') as HTMLInputElement;
    const narratorsInput = document.getElementById('book-narrators') as HTMLInputElement;
    const tagsInput = document.getElementById('book-tags') as HTMLInputElement;
    const descriptionInput = document.getElementById(
      'description',
    ) as HTMLTextAreaElement;

    const seriesName = (
      document.getElementById('series-name') as HTMLInputElement
    ).value.trim();
    const seriesNumber = (
      document.getElementById('series-number') as HTMLInputElement
    ).value.trim();
    const publisher = (
      document.getElementById('publisher') as HTMLInputElement
    ).value.trim();
    const publishDate = (document.getElementById('publish-date') as HTMLInputElement)
      .value;
    const pageCountValue = (document.getElementById('page-count') as HTMLInputElement)
      .value;
    const finishedDateValue = this.finishedDateInput?.value.trim();

    const seriesDetails =
      seriesName || seriesNumber
        ? {
            name: seriesName || undefined,
            number: seriesNumber || undefined,
          }
        : undefined;

    const payload: BookImportPayload = {
      source: this.book?.source ?? 'unknown',
      sourceUrl: this.book?.sourceUrl ?? '',
      title: titleInput.value.trim(),
      subtitle: this.book?.subtitle,
      authors: csvToArray(authorsInput.value),
      narrators: csvToArray(narratorsInput.value),
      description: descriptionInput.value.trim(),
      coverImage: this.book?.coverImage,
      identifiers: {
        isbn10:
          (document.getElementById('isbn10') as HTMLInputElement).value.trim() ||
          undefined,
        isbn13:
          (document.getElementById('isbn13') as HTMLInputElement).value.trim() ||
          undefined,
        asin:
          (document.getElementById('asin') as HTMLInputElement).value.trim() || undefined,
        amazonId:
          (document.getElementById('amazonId') as HTMLInputElement).value.trim() ||
          undefined,
        goodreadsId:
          (document.getElementById('goodreadsId') as HTMLInputElement).value.trim() ||
          undefined,
      },
      publisher: publisher || undefined,
      publishDate: publishDate || undefined,
      pageCount: pageCountValue ? Number(pageCountValue) : undefined,
      series: seriesDetails,
      tags: mergeTags(csvToArray(tagsInput.value), this.options?.defaultTags ?? []),
      addToLibrary: this.addToLibraryInput?.checked ?? false,
      markFinished: this.markFinishedInput?.checked ?? false,
      finishedDate: finishedDateValue || undefined,
    };

    return payload;
  }

  private setImportStatus(message: string, tone: 'info' | 'error' | 'success' = 'info') {
    if (!this.importStatusEl) {
      return;
    }
    this.importStatusEl.textContent = message;
    this.importStatusEl.dataset.tone = tone;
  }

  private toggleSpinner(active: boolean) {
    if (!this.spinnerEl) {
      return;
    }
    this.spinnerEl.classList.toggle('hidden', !active);
  }

  private handleFinishedToggle() {
    if (this.markFinishedInput?.checked && this.addToLibraryInput) {
      this.addToLibraryInput.checked = true;
    }
    if (
      this.markFinishedInput?.checked &&
      this.finishedDateInput &&
      !this.finishedDateInput.value
    ) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = `${today.getMonth() + 1}`.padStart(2, '0');
      const dd = `${today.getDate()}`.padStart(2, '0');
      this.finishedDateInput.value = `${yyyy}-${mm}-${dd}`;
    }
    this.updateFinishedDateVisibility();
    this.finishedDatePicker.render();
  }

  private updateFinishedDateVisibility() {
    if (!this.finishedDateWrapper) {
      return;
    }
    const shouldShow = this.markFinishedInput?.checked ?? false;
    this.finishedDateWrapper.classList.toggle('hidden', !shouldShow);
    if (!shouldShow) {
      this.finishedDatePicker.hide();
    }
  }

  private handleCalendarBlur(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Check if click is outside both date pickers
    if (this.finishedDatePicker.isVisible()) {
      if (
        !this.finishedDatePicker.contains(target) &&
        !this.finishedDateWrapper?.contains(target)
      ) {
        this.finishedDatePicker.hide();
      }
    }

    if (this.publishDatePicker.isVisible()) {
      if (!this.publishDatePicker.contains(target)) {
        this.publishDatePicker.hide();
      }
    }
  }

  private updateCoverPreview(src?: string) {
    if (src && this.coverPreviewImage) {
      this.coverPreviewImage.src = src;
      this.coverPreviewImage.classList.remove('hidden');
      this.coverPreviewPlaceholder?.classList.add('hidden');
    } else {
      if (this.coverPreviewImage) {
        this.coverPreviewImage.classList.add('hidden');
        this.coverPreviewImage.removeAttribute('src');
      }
      this.coverPreviewPlaceholder?.classList.remove('hidden');
    }
  }
}

const controller = new PopupController();
controller.init();
