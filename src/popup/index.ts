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
  private book: ScrapedBook | null = null;
  private options: StoredOptions | null = null;

  constructor() {
    this.form?.addEventListener('submit', (event) => this.handleSubmit(event));
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
  }

  private async handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!this.book || !this.options) {
      this.setStatus('Nothing to import yet.', 'error');
      return;
    }
    const submitBtn = this.form.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;
    this.setStatus('Sending to Jelu...');

    const payload = this.buildPayload();

    try {
      await browser.runtime.sendMessage({
        type: 'IMPORT_BOOK',
        payload,
      });
      this.setStatus('Import completed successfully.');
    } catch (error) {
      console.error('Import failed', error);
      this.setStatus('Import failed. Check logs for details.', 'error');
    } finally {
      submitBtn.disabled = false;
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
    };

    return payload;
  }
}

const controller = new PopupController();
controller.init();
