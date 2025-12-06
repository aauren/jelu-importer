import { ScrapedBook } from '../types/book';

export interface ParserContext {
  document: Document;
  url: URL;
}

export interface BookParser {
  id: string;
  matches: (url: URL) => boolean;
  parse: (context: ParserContext) => Promise<ScrapedBook | null>;
}
