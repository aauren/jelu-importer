import { cleanText, metaContent, textFrom, toNumber } from '../../common/dom';
import { BookSeriesInfo, ScrapedBook } from '../../types/book';
import { BookParser } from '../base';

type InfoMap = Record<string, string>;

interface GoogleBooksIndustryIdentifier {
  type?: string;
  identifier?: string;
}

interface GoogleBooksImageLinks {
  thumbnail?: string;
  smallThumbnail?: string;
}

interface GoogleBooksVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: GoogleBooksIndustryIdentifier[];
  pageCount?: number;
  categories?: string[];
  imageLinks?: GoogleBooksImageLinks;
}

interface GoogleBooksApiResponse {
  volumeInfo?: GoogleBooksVolumeInfo;
}

function buildInfoMap(document: Document): InfoMap {
  const map: InfoMap = {};
  const store = (key?: string | null, value?: string | null) => {
    const normalizedKey = cleanText(key ?? undefined)?.toLowerCase();
    const normalizedValue = cleanText(value ?? undefined);
    if (normalizedKey && normalizedValue) {
      map[normalizedKey] = normalizedValue;
    }
  };

  document.querySelectorAll('.kc7Grd').forEach((row) => {
    const label = row.querySelector('.w8qArf')?.textContent;
    const value = row.querySelector('.LrzXr')?.textContent;
    store(label, value);
  });

  document.querySelectorAll('#metadata_content_table .metadata_row').forEach((row) => {
    const label = row.querySelector('.metadata_label')?.textContent;
    const value = row.querySelector('.metadata_value')?.textContent;
    store(label, value);
  });

  return map;
}

function extractTitle(document: Document): string | undefined {
  return (
    cleanText(textFrom(document.querySelector('.UDZeY'))) ||
    cleanText(textFrom(document.querySelector('.booktitle .fn'))) ||
    metaContent(document, 'meta[property="og:title"]') ||
    metaContent(document, 'meta[name="title"]')
  );
}

function extractDescription(document: Document): string | undefined {
  const selectors = ['[jsname="bN97Pc"]', '#synopsistext', '#synopsis-window'] as const;
  for (const selector of selectors) {
    const value = cleanText(textFrom(document.querySelector(selector)));
    if (value) {
      return value;
    }
  }
  return (
    metaContent(document, 'meta[property="og:description"]') ||
    metaContent(document, 'meta[name="description"]') ||
    undefined
  );
}

function extractAuthors(document: Document, infoMap: InfoMap): string[] {
  const authors = new Set<string>();
  const selectors = ['.KJcZOe .aIX766', '.bookinfo_sectionwrap a.secondary span', '.bookinfo_sectionwrap a.secondary'];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      const value = cleanText(node.textContent ?? undefined);
      if (value) {
        authors.add(value);
      }
    });
  });

  if (!authors.size) {
    const fallback = infoMap['authors'] || infoMap['author'];
    if (fallback) {
      fallback
        .split(/[;,]/)
        .map((name) => cleanText(name))
        .filter((name): name is string => Boolean(name))
        .forEach((name) => authors.add(name));
    }
  }

  return Array.from(authors);
}

function extractSubjects(document: Document, infoMap: InfoMap): string[] {
  const tags = new Set<string>();
  const subjectRows = document.querySelectorAll('#metadata_content_table .metadata_row');
  subjectRows.forEach((row) => {
    const label = cleanText(row.querySelector('.metadata_label')?.textContent ?? undefined);
    if (!label || !label.toLowerCase().includes('subject')) {
      return;
    }
    row.querySelectorAll('.metadata_value a, .metadata_value span').forEach((node) => {
      const value = cleanText(node.textContent ?? undefined);
      if (value) {
        tags.add(value.replace(/\u203a/g, '›'));
      }
    });
  });

  if (!tags.size && infoMap['subjects']) {
    infoMap['subjects']
      .split(/›|>/)
      .map((entry) => cleanText(entry))
      .filter((entry): entry is string => Boolean(entry))
      .forEach((entry) => tags.add(entry));
  }

  return Array.from(tags);
}

function extractPublisher(infoMap: InfoMap): { publisher?: string; publishDate?: string; pageCountText?: string } {
  const rawPublisher = infoMap['publisher'];
  if (!rawPublisher) {
    return {};
  }
  const parts = rawPublisher.split(',').map((part) => cleanText(part ?? undefined)).filter(Boolean) as string[];
  if (!parts.length) {
    return {};
  }
  const publisher = parts[0];
  let publishDate = cleanText(infoMap['published'] ?? undefined);
  let remainder = cleanText(parts.slice(1).join(', ') ?? undefined);
  if (!publishDate && remainder) {
    const segments = remainder.split('-');
    const candidate = cleanText(segments[0]);
    if (candidate && /\d{4}/.test(candidate)) {
      publishDate = candidate;
    }
    remainder = cleanText(segments.slice(1).join('-') ?? undefined);
  }

  const pageMatch = rawPublisher.match(/(\d{1,5})\s+pages/i);
  const pageCountText = pageMatch ? pageMatch[1] : undefined;

  return {
    publisher,
    publishDate,
    pageCountText,
  };
}

function extractIsbn(value: string | undefined, length: 10 | 13): string | undefined {
  if (!value) {
    return undefined;
  }
  const matches = value.match(/[0-9Xx-]+/g);
  if (!matches) {
    return undefined;
  }
  for (const match of matches) {
    const digits = match.replace(/[^0-9Xx]/g, '');
    if (digits.length === length) {
      return digits.toUpperCase();
    }
  }
  return undefined;
}

function extractSeries(document: Document): BookSeriesInfo | undefined {
  const nodes = document.querySelectorAll('#metadata_content_table .metadata_value a.primary, .bookinfo_sectionwrap a.primary');
  for (const node of Array.from(nodes)) {
    const text = cleanText(node.textContent ?? undefined);
    if (!text) {
      continue;
    }
    const match = text.match(/(?:Book|Volume)\s+([\d.]+)\s+of\s+(.+)/i);
    if (match) {
      return {
        number: match[1],
        name: match[2].trim(),
      };
    }
    if (/series$/i.test(text) && !text.toLowerCase().includes('book')) {
      return {
        name: text,
      };
    }
  }
  return undefined;
}

async function parseGoogleBooks(document: Document, url: URL): Promise<ScrapedBook | null> {
  const domResult = parseFromDom(document, url);
  if (domResult) {
    return domResult;
  }

  const apiResult = await fetchFromBooksApi(url);
  if (!apiResult) {
    return null;
  }

  return enrichWithDom(apiResult, document);
}

function isGoogleBooksUrl(url: URL): boolean {
  if (url.hostname.includes('books.google.')) {
    return true;
  }
  return url.hostname === 'www.google.com' && url.pathname.startsWith('/books');
}

export const googleBooksParser: BookParser = {
  id: 'google-books',
  matches: (url) => isGoogleBooksUrl(url),
  parse: async ({ document, url }) => parseGoogleBooks(document, url),
};

function parseFromDom(document: Document, url: URL): ScrapedBook | null {
  const title = extractTitle(document);
  if (!title) {
    return null;
  }

  const infoMap = buildInfoMap(document);
  const description = extractDescription(document);
  const coverImage =
    metaContent(document, 'meta[property="og:image"]') ||
    document.querySelector<HTMLImageElement>('#summary-frontcover')?.getAttribute('src') ||
    undefined;
  const authors = extractAuthors(document, infoMap);
  const tags = extractSubjects(document, infoMap);

  const { publisher, publishDate, pageCountText } = extractPublisher(infoMap);
  const pageCount = infoMap['length'] || infoMap['print length'] || pageCountText;
  const isbnField = infoMap['isbn'];
  const series = extractSeries(document);

  const isbn10 = infoMap['isbn 10'] || extractIsbn(isbnField, 10);
  const isbn13 = infoMap['isbn 13'] || extractIsbn(isbnField, 13);

  return {
    source: 'google-books',
    sourceUrl: url.toString(),
    title,
    authors,
    description,
    coverImage: coverImage ?? undefined,
    identifiers: {
      isbn10,
      isbn13,
    },
    publisher,
    publishDate,
    pageCount: pageCount ? toNumber(pageCount) : undefined,
    tags,
    series,
  };
}

function enrichWithDom(book: ScrapedBook, document: Document): ScrapedBook {
  const infoMap = buildInfoMap(document);
  const description = extractDescription(document);
  const coverImage =
    metaContent(document, 'meta[property="og:image"]') ||
    document.querySelector<HTMLImageElement>('#summary-frontcover')?.getAttribute('src') ||
    undefined;
  const { publisher, publishDate, pageCountText } = extractPublisher(infoMap);
  const isbnField = infoMap['isbn'];
  const isbn10 = book.identifiers.isbn10 ?? infoMap['isbn 10'] ?? extractIsbn(isbnField, 10);
  const isbn13 = book.identifiers.isbn13 ?? infoMap['isbn 13'] ?? extractIsbn(isbnField, 13);
  const authors = book.authors?.length ? book.authors : extractAuthors(document, infoMap);
  const tags = book.tags?.length ? book.tags : extractSubjects(document, infoMap);
  const pageCount = book.pageCount ?? (pageCountText ? toNumber(pageCountText) : undefined);
  const series = book.series ?? extractSeries(document);

  return {
    ...book,
    description: book.description ?? description,
    coverImage: book.coverImage ?? coverImage,
    publisher: book.publisher ?? publisher,
    publishDate: book.publishDate ?? publishDate,
    pageCount,
    authors,
    tags,
    series,
    identifiers: {
      ...book.identifiers,
      isbn10,
      isbn13,
    },
  };
}

function extractVolumeId(url: URL): string | undefined {
  const queryId = url.searchParams.get('id');
  if (queryId) {
    return queryId;
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (!segments.length) {
    return undefined;
  }
  const last = segments[segments.length - 1];
  if (last !== 'edition' && last !== 'reader' && last !== 'books') {
    return last;
  }
  if (segments.length >= 2) {
    return segments[segments.length - 2];
  }
  return undefined;
}

function sanitizeHtml(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(value, 'text/html');
    return cleanText(doc.body.textContent ?? undefined);
  } catch {
    return cleanText(value);
  }
}

function normalizeHttpsUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.replace(/^http:\/\//i, 'https://');
}

async function fetchFromBooksApi(url: URL): Promise<ScrapedBook | null> {
  const volumeId = extractVolumeId(url);
  if (!volumeId) {
    return null;
  }

  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${volumeId}`);
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as GoogleBooksApiResponse;
    const info = payload.volumeInfo;
    if (!info?.title) {
      return null;
    }

    const identifiers = info.industryIdentifiers ?? [];
    const isbn10 = identifiers.find((item) => item.type === 'ISBN_10')?.identifier;
    const isbn13 = identifiers.find((item) => item.type === 'ISBN_13')?.identifier;

    return {
      source: 'google-books',
      sourceUrl: url.toString(),
      title: info.title,
      subtitle: info.subtitle,
      authors: info.authors ?? [],
      description: sanitizeHtml(info.description),
      coverImage:
        normalizeHttpsUrl(info.imageLinks?.thumbnail) ||
        normalizeHttpsUrl(info.imageLinks?.smallThumbnail) ||
        undefined,
      identifiers: {
        isbn10,
        isbn13,
      },
      publisher: info.publisher,
      publishDate: info.publishedDate,
      pageCount: info.pageCount,
      tags: info.categories ?? [],
    };
  } catch (error) {
    console.warn('Failed to fetch Google Books API metadata', error);
    return null;
  }
}
