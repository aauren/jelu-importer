import browser from 'webextension-polyfill';
import { BookImportPayload, ScrapedBook, StoredOptions } from '../types/book';
import { getOptions } from '../common/storage';

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

class PopupController {
  private statusEl = document.getElementById('status') as HTMLElement;
  private editorEl = document.getElementById('editor') as HTMLElement;
  private form = document.getElementById('import-form') as HTMLFormElement;
  private addToLibraryInput = document.getElementById('add-to-library') as HTMLInputElement;
  private markFinishedInput = document.getElementById('mark-finished') as HTMLInputElement;
  private finishedDateWrapper = document.getElementById('finished-date-wrapper') as HTMLElement;
  private finishedDateInput = document.getElementById('finished-date') as HTMLInputElement;
  private calendarToggleBtn = document.getElementById('finished-date-picker') as HTMLButtonElement;
  private calendarContainer = document.getElementById('finished-date-calendar') as HTMLElement;
  private calendarMonthLabel = document.getElementById('calendar-month') as HTMLElement;
  private calendarYearSelect = document.getElementById('calendar-year') as HTMLSelectElement;
  private calendarGrid = document.getElementById('calendar-grid') as HTMLElement;
  private calendarPrevBtn = document.getElementById('calendar-prev') as HTMLButtonElement;
  private calendarNextBtn = document.getElementById('calendar-next') as HTMLButtonElement;
  private coverPreviewImage = document.getElementById('cover-preview-image') as HTMLImageElement | null;
  private coverPreviewPlaceholder = document.getElementById('cover-preview-placeholder') as HTMLElement | null;
  private importStatusEl = document.getElementById('import-status') as HTMLElement;
  private spinnerEl = document.getElementById('submit-spinner') as HTMLElement;
  private book: ScrapedBook | null = null;
  private options: StoredOptions | null = null;
  private calendarVisible = false;
  private calendarCursor = new Date();

  constructor() {
    this.form?.addEventListener('submit', (event) => this.handleSubmit(event));
    this.markFinishedInput?.addEventListener('change', () => this.handleFinishedToggle());
    this.calendarToggleBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      this.toggleCalendar(!this.calendarVisible);
    });
    this.calendarPrevBtn?.addEventListener('click', () => this.shiftCalendar(-1));
    this.calendarNextBtn?.addEventListener('click', () => this.shiftCalendar(1));
    this.calendarYearSelect?.addEventListener('change', () => this.handleYearSelect());
    this.finishedDateInput?.addEventListener('input', () => this.syncCalendarCursor());
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
      this.editorEl.classList.remove('hidden');
      this.setStatus('Review the data and send it to Jelu.');
    } catch (error) {
      console.error('Failed to scrape page', error);
      this.setStatus('Could not gather book information from this page.', 'error');
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
    (document.getElementById('publisher') as HTMLInputElement).value = book.publisher ?? '';
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
    (document.getElementById('asin') as HTMLInputElement).value = book.identifiers.asin ?? '';
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
    this.renderCalendar();
    this.setImportStatus('');
    this.updateCoverPreview(book.coverImage);
  }

  private async handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!this.book || !this.options) {
      this.setStatus('Nothing to import yet.', 'error');
      return;
    }
    const submitBtn = this.form.querySelector('button[type="submit"]') as HTMLButtonElement;
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
    const descriptionInput = document.getElementById('description') as HTMLTextAreaElement;

    const seriesName = (document.getElementById('series-name') as HTMLInputElement).value.trim();
    const seriesNumber = (document.getElementById('series-number') as HTMLInputElement).value.trim();
    const publisher = (document.getElementById('publisher') as HTMLInputElement).value.trim();
    const publishDate = (document.getElementById('publish-date') as HTMLInputElement).value;
    const pageCountValue = (document.getElementById('page-count') as HTMLInputElement).value;
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
        isbn10: (document.getElementById('isbn10') as HTMLInputElement).value.trim() || undefined,
        isbn13: (document.getElementById('isbn13') as HTMLInputElement).value.trim() || undefined,
        asin: (document.getElementById('asin') as HTMLInputElement).value.trim() || undefined,
        amazonId:
          (document.getElementById('amazonId') as HTMLInputElement).value.trim() || undefined,
        goodreadsId:
          (document.getElementById('goodreadsId') as HTMLInputElement).value.trim() || undefined,
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
    if (this.markFinishedInput?.checked && this.finishedDateInput && !this.finishedDateInput.value) {
      this.finishedDateInput.value = this.formatDate(new Date());
    }
    this.updateFinishedDateVisibility();
    this.syncCalendarCursor();
    this.renderCalendar();
  }

  private updateFinishedDateVisibility() {
    if (!this.finishedDateWrapper) {
      return;
    }
    const shouldShow = this.markFinishedInput?.checked ?? false;
    this.finishedDateWrapper.classList.toggle('hidden', !shouldShow);
    if (!shouldShow) {
      this.toggleCalendar(false);
    }
  }

  private toggleCalendar(show: boolean = !this.calendarVisible) {
    if (!this.calendarContainer) {
      return;
    }
    this.calendarVisible = show;
    this.calendarContainer.classList.toggle('hidden', !show);
    if (show) {
      this.renderCalendar();
    }
  }

  private shiftCalendar(delta: number) {
    this.calendarCursor = new Date(
      this.calendarCursor.getFullYear(),
      this.calendarCursor.getMonth() + delta,
      1,
    );
    this.renderCalendar();
  }

  private handleYearSelect() {
    if (!this.calendarYearSelect) {
      return;
    }
    const year = Number(this.calendarYearSelect.value);
    if (!Number.isFinite(year)) {
      return;
    }
    this.calendarCursor = new Date(year, this.calendarCursor.getMonth(), 1);
    this.renderCalendar();
  }

  private syncCalendarCursor() {
    const parsed = this.parseDate(this.finishedDateInput?.value);
    if (parsed) {
      this.calendarCursor = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    }
  }

  private renderCalendar() {
    if (!this.calendarGrid || !this.calendarMonthLabel || !this.finishedDateInput) {
      return;
    }
    const base = new Date(
      this.calendarCursor.getFullYear(),
      this.calendarCursor.getMonth(),
      1,
    );
    const locale = navigator.language || 'en-US';
    this.calendarMonthLabel.textContent = base.toLocaleDateString(locale, {
      month: 'long',
    });
    this.buildYearOptions(base.getFullYear());
    const currentValue = this.finishedDateInput.value;
    const currentParsed = this.parseDate(currentValue);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const firstDay = base.getDay();

    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const fragments: string[] = [];
    weekdays.forEach((day) => {
      fragments.push(`<div class="weekday">${day}</div>`);
    });

    for (let i = 0; i < firstDay; i += 1) {
      fragments.push('<div class="empty"></div>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(base.getFullYear(), base.getMonth(), day);
      const formatted = this.formatDate(date);
      const isCurrent = currentParsed
        ? date.toDateString() === currentParsed.toDateString()
        : false;
      fragments.push(
        `<button type="button" data-date="${formatted}" data-current="${isCurrent}">${day}</button>`,
      );
    }

    this.calendarGrid.innerHTML = fragments.join('');
    Array.from(this.calendarGrid.querySelectorAll('button[data-date]')).forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.getAttribute('data-date');
        if (value && this.finishedDateInput) {
          this.finishedDateInput.value = value;
          this.toggleCalendar(false);
        }
      });
    });
  }

  private handleCalendarBlur(event: MouseEvent) {
    if (!this.calendarVisible) {
      return;
    }
    const target = event.target as HTMLElement;
    if (
      this.calendarContainer?.contains(target) ||
      this.calendarToggleBtn?.contains(target) ||
      this.finishedDateWrapper?.contains(target)
    ) {
      return;
    }
    this.toggleCalendar(false);
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
    if (!this.calendarYearSelect) {
      return;
    }
    const nowYear = new Date().getFullYear();
    const range = 40;
    const minYear = Math.max(1900, Math.min(selectedYear, nowYear) - range);
    const maxYear = Math.max(selectedYear, nowYear) + 2;
    const options: string[] = [];
    for (let year = minYear; year <= maxYear; year += 1) {
      options.push(
        `<option value="${year}" ${year === selectedYear ? 'selected' : ''}>${year}</option>`,
      );
    }
    this.calendarYearSelect.innerHTML = options.join('');
    this.calendarYearSelect.value = String(selectedYear);
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
