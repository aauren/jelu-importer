import { cleanText, metaContent, textFrom, toNumber } from '../../common/dom';
import { createDebugLogger } from '../../common/logger';
import { ScrapedBook } from '../../types/book';
import { BookParser, ParserContext } from '../base';

const debugLog = createDebugLogger('audible');

async function parseAudible(context: ParserContext): Promise<ScrapedBook | null> {
  const { document, url, options } = context;
  debugLog(options, 'Parsing Audible page', url.toString());
  const title = cleanText(textFrom(document.querySelector('h1[data-testid="hero-title-block__title"]')));
  if (!title) {
    debugLog(options, 'Unable to locate title on Audible page; aborting');
    return null;
  }

  const authors = Array.from(document.querySelectorAll('li[data-testid="author-info"] a'))
    .map((el) => el.textContent?.trim())
    .filter((entry): entry is string => Boolean(entry));

  const narrators = Array.from(document.querySelectorAll('li[data-testid="narrator-info"] a'))
    .map((el) => el.textContent?.trim())
    .filter((entry): entry is string => Boolean(entry));

  const description = cleanText(
    textFrom(document.querySelector('[data-testid="product-details-description"]')),
  );

  const coverImage =
    document.querySelector('[data-testid="hero-art"] img')?.getAttribute('src') ||
    metaContent(document, 'meta[property="og:image"]');

  const runtime = textFrom(document.querySelector('[data-testid="runtime"] span span'));
  const releaseDate = textFrom(document.querySelector('[data-testid="release-date"] span span'));
  const publisher = textFrom(document.querySelector('[data-testid="publisher"] span span'));

  const parsed: ScrapedBook = {
    source: 'audible',
    sourceUrl: url.toString(),
    title,
    authors,
    narrators,
    description,
    coverImage: coverImage ?? undefined,
    identifiers: {
      asin: textFrom(document.querySelector('[data-testid="product-details"] li span strong')),
    },
    publisher,
    publishDate: releaseDate,
    pageCount: runtime ? toNumber(runtime) : undefined,
    tags: [],
  };
  debugLog(options, 'Parsed Audible metadata', {
    title: parsed.title,
    authors: parsed.authors,
  });
  return parsed;
}

export const audibleParser: BookParser = {
  id: 'audible',
  matches: (url) => url.hostname.includes('audible.'),
  parse: parseAudible,
};
