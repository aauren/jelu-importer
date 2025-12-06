import { BookImportPayload, BookSeriesInfo, StoredOptions } from '../types/book';

interface AuthorPayload {
  name: string;
}

interface TagPayload {
  name: string;
}

interface SeriesOrderPayload {
  seriesId?: string | null;
  name: string;
  numberInSeries?: number;
}

interface BookCreateRequest {
  title: string;
  isbn10?: string;
  isbn13?: string;
  summary?: string;
  image?: string;
  publisher?: string;
  pageCount?: number;
  publishedDate?: string;
  authors?: AuthorPayload[];
  translators?: AuthorPayload[];
  narrators?: AuthorPayload[];
  tags?: TagPayload[];
  series?: SeriesOrderPayload[];
  googleId?: string;
  amazonId?: string;
  goodreadsId?: string;
  librarythingId?: string;
  isfdbId?: string;
  openlibraryId?: string;
  noosfereId?: string;
  inventaireId?: string;
  language?: string;
}

interface UserBookCreateRequest {
  book: BookCreateRequest;
  owned?: boolean;
  toRead?: boolean;
  borrowed?: boolean;
  percentRead?: number;
  currentPageNumber?: number;
  personalNotes?: string;
  lastReadingEvent?: string;
  lastReadingEventDate?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export class JeluClient {
  constructor(private readonly options: StoredOptions) {}

  private buildAuthHeaders(): Record<string, string> {
    if (this.options.authStrategy === 'token' && this.options.apiToken) {
      return { 'X-Auth-Token': this.options.apiToken };
    }

    if (
      this.options.authStrategy === 'password' &&
      this.options.username &&
      this.options.password
    ) {
      const encoded = btoa(`${this.options.username}:${this.options.password}`);
      return { Authorization: `Basic ${encoded}` };
    }

    throw new Error('No valid authentication configuration provided.');
  }

  async importBook(book: BookImportPayload): Promise<void> {
    if (!this.options.jeluUrl) {
      throw new Error('Jelu base URL not configured.');
    }

    if (book.addToLibrary) {
      await this.createUserBook(book);
    } else {
      await this.createStandaloneBook(book);
    }
  }

  private async createStandaloneBook(book: BookImportPayload): Promise<void> {
    const baseUrl = normalizeBaseUrl(this.options.jeluUrl);
    const payload = this.mapToBookRequest(book);

    const response = await fetch(`${baseUrl}/api/v1/books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jelu API responded with ${response.status}: ${text}`);
    }
  }

  private async createUserBook(book: BookImportPayload): Promise<void> {
    const baseUrl = normalizeBaseUrl(this.options.jeluUrl);
    const isFinished = Boolean(book.markFinished);
    const finishedDate = this.normalizeDate(book.finishedDate);
    const payload: UserBookCreateRequest = {
      book: this.mapToBookRequest(book),
      owned: true,
      toRead: !isFinished,
      borrowed: false,
      percentRead: isFinished ? 100 : undefined,
      lastReadingEvent: isFinished ? 'FINISHED' : undefined,
      lastReadingEventDate: isFinished ? finishedDate ?? new Date().toISOString() : undefined,
    };

    const response = await fetch(`${baseUrl}/api/v1/userbooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jelu API responded with ${response.status}: ${text}`);
    }
  }

  private mapToBookRequest(book: BookImportPayload): BookCreateRequest {
    const identifiers = book.identifiers ?? {};
    return {
      title: book.title,
      summary: book.description,
      image: book.coverImage,
      publisher: book.publisher,
      publishedDate: book.publishDate,
      pageCount: book.pageCount,
      authors: this.namesToAuthorDtos(book.authors),
      narrators: this.namesToAuthorDtos(book.narrators),
      tags: this.tagsToDtos(book.tags),
      series: this.seriesToDtos(book.series),
      amazonId: identifiers.amazonId ?? identifiers.asin,
      goodreadsId: identifiers.goodreadsId,
      isbn10: identifiers.isbn10,
      isbn13: identifiers.isbn13,
    };
  }

  private namesToAuthorDtos(names?: string[]): AuthorPayload[] | undefined {
    if (!names?.length) {
      return undefined;
    }
    const unique = Array.from(
      new Set(
        names
          .map((name) => name.trim())
          .filter((name) => Boolean(name)),
      ),
    );
    if (!unique.length) {
      return undefined;
    }
    return unique.map((name) => ({ name }));
  }

  private tagsToDtos(tags?: string[]): TagPayload[] | undefined {
    if (!tags?.length) {
      return undefined;
    }
    const unique = Array.from(
      new Set(
        tags
          .map((tag) => tag.trim())
          .filter((tag) => Boolean(tag)),
      ),
    );
    if (!unique.length) {
      return undefined;
    }
    return unique.map((name) => ({ name }));
  }

  private seriesToDtos(series?: BookSeriesInfo): SeriesOrderPayload[] | undefined {
    if (!series?.name) {
      return undefined;
    }
    return [
      {
        seriesId: null,
        name: series.name,
        numberInSeries: this.parseSeriesNumber(series.number),
      },
    ];
  }

  private parseSeriesNumber(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }
    const numeric = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  private normalizeDate(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }
    return parsed.toISOString();
  }
}
