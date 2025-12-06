import { cleanText, metaContent, textFrom, toNumber } from '../../common/dom';
import { ScrapedBook } from '../../types/book';
import { BookParser } from '../base';

async function parseAudible(document: Document, url: URL): Promise<ScrapedBook | null> {
  const title = cleanText(textFrom(document.querySelector('h1[data-testid="hero-title-block__title"]')));
  if (!title) {
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

  return {
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
}

export const audibleParser: BookParser = {
  id: 'audible',
  matches: (url) => url.hostname.includes('audible.'),
  parse: async ({ document, url }) => parseAudible(document, url),
};
