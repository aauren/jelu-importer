import { cleanText, metaContent, textFrom, toNumber } from '../../common/dom';
import { BookIdentifiers, ScrapedBook } from '../../types/book';
import { BookParser } from '../base';

function extractGoodreadsId(url: URL): string | undefined {
  const match = url.pathname.match(/(book\/show|work\/show)\/([0-9]+)[.-]?/);
  return match?.[2];
}

function firstMatchText(document: Document, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = cleanText(textFrom(document.querySelector(selector)));
    if (value) {
      return value;
    }
  }
  return undefined;
}

type ApolloState = Record<string, any>;

interface GoodreadsNextData {
  props?: {
    pageProps?: {
      apolloState?: ApolloState;
    };
  };
}

function readNextData(document: Document): ApolloState | null {
  const script = document.querySelector<HTMLScriptElement>('script#__NEXT_DATA__');
  if (!script?.textContent) {
    return null;
  }

  try {
    const data = JSON.parse(script.textContent) as GoodreadsNextData;
    return data.props?.pageProps?.apolloState ?? null;
  } catch (error) {
    console.warn('Failed to parse Goodreads __NEXT_DATA__ payload', error);
    return null;
  }
}

function findBookNode(apollo: ApolloState, goodreadsId?: string) {
  const entries = Object.entries(apollo).filter(([key]) => key.startsWith('Book:'));
  if (!entries.length) {
    return null;
  }

  if (goodreadsId) {
    const match = entries.find(([, value]) => {
      const legacyId = (value as { legacyId?: number | string }).legacyId;
      return legacyId !== undefined && String(legacyId) === goodreadsId;
    });
    if (match) {
      return match[1];
    }
  }

  return entries[0]?.[1] ?? null;
}

function resolveNode(apollo: ApolloState, ref?: { __ref?: string }) {
  if (!ref?.__ref) {
    return undefined;
  }
  return apollo[ref.__ref];
}

function resolveContributorName(apollo: ApolloState, ref?: { __ref?: string }) {
  const contributor = resolveNode(apollo, ref);
  const name = contributor?.name;
  return cleanText(typeof name === 'string' ? name : undefined);
}

function extractAuthorsFromApollo(apollo: ApolloState, book: any): string[] {
  const edges: Array<{ role?: string; node?: { __ref?: string } }> = [];
  if (book?.primaryContributorEdge) {
    edges.push(book.primaryContributorEdge);
  }
  if (Array.isArray(book?.secondaryContributorEdges)) {
    edges.push(...book.secondaryContributorEdges);
  }

  return edges
    .filter((edge) => edge.role?.toLowerCase().includes('author'))
    .map((edge): string | undefined => resolveContributorName(apollo, edge.node))
    .filter((name: string | undefined): name is string => Boolean(name));
}

function normalizeIdentifier(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const cleaned = value.replace(/[^0-9A-Za-z]/g, '');
  return cleaned || undefined;
}

function buildSeriesInfo(apollo: ApolloState, book: any) {
  const seriesEntry = Array.isArray(book?.bookSeries) ? book.bookSeries[0] : undefined;
  if (!seriesEntry) {
    return undefined;
  }

  const seriesNode = resolveNode(apollo, seriesEntry.series);
  const seriesTitle = cleanText(
    typeof seriesNode?.title === 'string' ? seriesNode.title : undefined,
  );
  const number = seriesEntry.userPosition;
  if (!seriesTitle && !number) {
    return undefined;
  }

  return {
    name: seriesTitle,
    number: number && number !== '0' ? number : undefined,
  };
}

function buildTags(book: any): string[] {
  if (!Array.isArray(book?.bookGenres)) {
    return [];
  }
  return book.bookGenres
    .map(
      (entry: any): string | undefined =>
        cleanText(typeof entry?.genre?.name === 'string' ? entry.genre.name : undefined),
    )
    .filter((name: string | undefined): name is string => Boolean(name));
}

function buildIdentifiers(details: any, goodreadsId?: string): BookIdentifiers {
  const asin = normalizeIdentifier(details?.asin);
  return {
    asin,
    amazonId: asin,
    isbn10: normalizeIdentifier(details?.isbn),
    isbn13: normalizeIdentifier(details?.isbn13),
    goodreadsId,
  };
}

function formatPublicationDate(value?: number | null): string | undefined {
  if (!value || Number.isNaN(value)) {
    return undefined;
  }
  try {
    return new Date(value).toISOString().split('T')[0];
  } catch {
    return undefined;
  }
}

function parseFromNextData(document: Document, url: URL): ScrapedBook | null {
  const apollo = readNextData(document);
  if (!apollo) {
    return null;
  }

  const goodreadsId = extractGoodreadsId(url);
  const book = findBookNode(apollo, goodreadsId);
  if (!book) {
    return null;
  }

  const details = book.details ?? {};
  const authors = extractAuthorsFromApollo(apollo, book);
  const description =
    cleanText((book as Record<string, unknown>)['description({"stripped":true})'] as
      | string
      | undefined) ?? cleanText(book.description);

  return {
    source: 'goodreads',
    sourceUrl: url.toString(),
    title: cleanText(book.titleComplete ?? book.title) ?? 'Unknown title',
    subtitle: undefined,
    authors,
    description,
    coverImage: book.imageUrl ?? undefined,
    narrators: undefined,
    identifiers: buildIdentifiers(details, goodreadsId ?? (book.legacyId ? String(book.legacyId) : undefined)),
    publisher: details?.publisher ?? undefined,
    publishDate: formatPublicationDate(details?.publicationTime),
    pageCount: typeof details?.numPages === 'number' ? details.numPages : undefined,
    series: buildSeriesInfo(apollo, book),
    tags: buildTags(book),
  };
}

async function parseFromLegacyDom(document: Document, url: URL): Promise<ScrapedBook | null> {
  const title =
    firstMatchText(document, [
      '#bookTitle',
      '[data-testid="bookTitle"]',
      'h1#bookTitle span',
      'h1[data-testid="bookTitle"]',
    ]) ?? cleanText(metaContent(document, 'meta[property="og:title"]'));
  if (!title) {
    return null;
  }

  const authors = Array.from(
    document.querySelectorAll(
      '#bookAuthors span[itemprop="name"], a.authorName span, a[data-testid="name"]',
    ),
  )
    .map((el) => el.textContent?.trim())
    .filter((name: string | undefined): name is string => Boolean(name));

  const description =
    firstMatchText(document, ['#description span', '[data-testid="description"]']) ??
    cleanText(metaContent(document, 'meta[property="og:description"]'));
  const coverImage =
    document.querySelector('#coverImage')?.getAttribute('src') ||
    document.querySelector('[data-testid="coverImage"] img')?.getAttribute('src') ||
    metaContent(document, 'meta[property="og:image"]');
  const pageCount = toNumber(
    textFrom(document.querySelector('[itemprop="numberOfPages"]')),
  );
  const publisherText = textFrom(document.querySelector('#details div.row'));
  const publishDate = textFrom(document.querySelector('#details > div:nth-child(2)'));

  const isbn10 = textFrom(document.querySelector('#bookDataBox .clearFloats span[itemprop="isbn"]'));
  const isbn13 = textFrom(document.querySelector('#bookDataBox span[itemprop="isbn13"]'));

  const seriesName = cleanText(textFrom(document.querySelector('#bookSeries a')));
  const seriesNumberMatch = textFrom(document.querySelector('#bookSeries'))?.match(/#([0-9]+)/);
  const seriesNumber = seriesNumberMatch?.[1];

  const tags = Array.from(document.querySelectorAll('.left a.bookPageGenreLink'))
    .map((el) => el.textContent?.trim() || '')
    .filter(Boolean);

  return {
    source: 'goodreads',
    sourceUrl: url.toString(),
    title,
    subtitle: undefined,
    authors,
    description,
    coverImage: coverImage || undefined,
    narrators: undefined,
    identifiers: {
      isbn10: isbn10?.replace(/ISBN|:|\s/g, ''),
      isbn13: isbn13?.replace(/ISBN13|:|\s/g, ''),
      goodreadsId: extractGoodreadsId(url),
    },
    publisher: publisherText,
    publishDate,
    pageCount,
    series: {
      name: seriesName,
      number: seriesNumber,
    },
    tags,
  };
}

export const goodreadsParser: BookParser = {
  id: 'goodreads',
  matches: (url) => url.hostname.includes('goodreads.com'),
  parse: async ({ document, url }) => {
    const structured = parseFromNextData(document, url);
    if (structured) {
      return structured;
    }
    return parseFromLegacyDom(document, url);
  },
};
