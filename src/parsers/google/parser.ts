import { cleanText, metaContent, textFrom, toNumber } from '../../common/dom';
import { ScrapedBook } from '../../types/book';
import { BookParser } from '../base';

async function parseGoogleBooks(document: Document, url: URL): Promise<ScrapedBook | null> {
  const title =
    cleanText(textFrom(document.querySelector('.UDZeY')) || metaContent(document, 'meta[property="og:title"]'));
  if (!title) {
    return null;
  }

  const description = cleanText(
    textFrom(document.querySelector('[jsname="bN97Pc"]')) ||
      metaContent(document, 'meta[property="og:description"]'),
  );

  const coverImage = metaContent(document, 'meta[property="og:image"]');
  const authors = Array.from(document.querySelectorAll('.KJcZOe .aIX766'))
    .map((el) => el.textContent?.trim())
    .filter((entry): entry is string => Boolean(entry));

  const infoRows = Array.from(document.querySelectorAll('.kc7Grd'));
  const infoMap: Record<string, string> = {};
  infoRows.forEach((row) => {
    const label = row.querySelector('.w8qArf')?.textContent?.trim();
    const value = row.querySelector('.LrzXr')?.textContent?.trim();
    if (label && value) {
      infoMap[label.toLowerCase()] = value;
    }
  });

  const pageCount = infoMap['length'] || infoMap['print length'];
  const publisher = infoMap['publisher'];
  const publishDate = infoMap['published'];

  return {
    source: 'google-books',
    sourceUrl: url.toString(),
    title,
    authors,
    description,
    coverImage: coverImage ?? undefined,
    identifiers: {
      isbn10: infoMap['isbn 10'],
      isbn13: infoMap['isbn 13'],
    },
    publisher,
    publishDate,
    pageCount: pageCount ? toNumber(pageCount) : undefined,
    tags: [],
  };
}

export const googleBooksParser: BookParser = {
  id: 'google-books',
  matches: (url) => url.hostname.includes('books.google.'),
  parse: async ({ document, url }) => parseGoogleBooks(document, url),
};
