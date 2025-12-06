import { BookImportPayload, ScrapedBook } from './book';

export type RuntimeMessage =
  | { type: 'SCRAPE_PAGE' }
  | { type: 'BOOK_SCRAPED'; payload: ScrapedBook | null }
  | { type: 'IMPORT_BOOK'; payload: BookImportPayload }
  | { type: 'OPTIONS_UPDATED' };
