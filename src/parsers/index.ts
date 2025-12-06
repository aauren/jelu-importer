import { BookParser } from './base';
import { goodreadsParser } from './goodreads/parser';
import { amazonParser } from './amazon/parser';
import { audibleParser } from './audible/parser';
import { googleBooksParser } from './google/parser';

const parsers: BookParser[] = [
  goodreadsParser,
  amazonParser,
  audibleParser,
  googleBooksParser,
];

export function findParser(url: URL): BookParser | undefined {
  return parsers.find((parser) => parser.matches(url));
}
