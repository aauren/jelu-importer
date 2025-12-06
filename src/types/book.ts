export type SupportedSource = 'goodreads' | 'amazon' | 'audible' | 'google-books';

export interface BookIdentifiers {
  isbn10?: string;
  isbn13?: string;
  asin?: string;
  amazonId?: string;
  goodreadsId?: string;
}

export interface BookSeriesInfo {
  name?: string;
  number?: string;
}

export interface ScrapedBook {
  source: SupportedSource | string;
  sourceUrl: string;
  title: string;
  subtitle?: string;
  authors: string[];
  narrators?: string[];
  description?: string;
  coverImage?: string;
  identifiers: BookIdentifiers;
  publisher?: string;
  publishDate?: string;
  pageCount?: number;
  series?: BookSeriesInfo;
  tags?: string[];
}

export interface BookImportPayload extends ScrapedBook {
  tags: string[];
  addToLibrary?: boolean;
  markFinished?: boolean;
  finishedDate?: string;
}

export type AuthStrategy = 'token' | 'password';

export interface StoredOptions {
  jeluUrl: string;
  apiToken?: string;
  username?: string;
  password?: string;
  defaultTags: string[];
  authStrategy: AuthStrategy;
  defaultAddToLibrary: boolean;
}

export const defaultOptions: StoredOptions = {
  jeluUrl: '',
  apiToken: '',
  username: '',
  password: '',
  defaultTags: [],
  authStrategy: 'token',
  defaultAddToLibrary: false,
};
