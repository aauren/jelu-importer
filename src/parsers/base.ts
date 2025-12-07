import { ScrapedBook, StoredOptions } from '../types/book';

export interface ParserContext {
  document: Document;
  url: URL;
  options?: StoredOptions;
}

export interface BookParser {
  id: string;
  matches: (url: URL) => boolean;
  parse: (context: ParserContext) => Promise<ScrapedBook | null>;
}
