import { cleanText, metaContent, textFrom, toNumber } from '../../common/dom';
import { createDebugLogger } from '../../common/logger';
import { BookSeriesInfo, ScrapedBook, StoredOptions } from '../../types/book';
import { BookParser, ParserContext } from '../base';

const debugLog = createDebugLogger('audible');

interface AudibleContributor {
  name?: string;
}

interface AudibleSeriesEntry {
  part?: string;
  name?: string;
}

interface AudibleCategory {
  name?: string;
}

interface AudibleMetadataEntry {
  authors?: AudibleContributor[];
  narrators?: AudibleContributor[];
  duration?: string;
  releaseDate?: string;
  series?: AudibleSeriesEntry[];
  publisher?: {
    name?: string;
  };
  categories?: AudibleCategory[];
}

function parseMetadataScript(
  script: HTMLScriptElement,
  options?: StoredOptions,
): AudibleMetadataEntry | null {
  const payload = script?.textContent;
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(payload) as AudibleMetadataEntry;
  } catch (error) {
    debugLog(options, 'Failed to parse Audible metadata JSON', error);
    return null;
  }
}

function collectMetadataEntries(document: Document, options?: StoredOptions): AudibleMetadataEntry[] {
  const entries: AudibleMetadataEntry[] = [];
  document.querySelectorAll('adbl-product-metadata script[type="application/json"]').forEach((node) => {
    const parsed = parseMetadataScript(node as HTMLScriptElement, options);
    if (parsed) {
      entries.push(parsed);
    }
  });
  return entries;
}

function findHeroMetadata(entries: AudibleMetadataEntry[]): AudibleMetadataEntry | undefined {
  return entries.find((entry) => entry.authors || entry.narrators);
}

function findDetailsMetadata(entries: AudibleMetadataEntry[]): AudibleMetadataEntry | undefined {
  return entries.find(
    (entry) =>
      entry.duration ||
      entry.releaseDate ||
      entry.series ||
      entry.publisher ||
      (entry.categories && entry.categories.length),
  );
}

function namesFromMetadata(entries?: AudibleContributor[]): string[] | undefined {
  if (!Array.isArray(entries)) {
    return undefined;
  }
  const names = entries
    .map((entry) => cleanText(entry?.name ?? undefined))
    .filter((name): name is string => Boolean(name));
  return names.length ? names : undefined;
}

function namesFromSelector(document: Document, selector: string): string[] | undefined {
  const values = Array.from(document.querySelectorAll(selector))
    .map((node) => cleanText(node.textContent ?? undefined))
    .filter((name): name is string => Boolean(name));
  return values.length ? values : undefined;
}

function normalizeReleaseDate(value?: string): string | undefined {
  const text = cleanText(value ?? undefined);
  if (!text) {
    return undefined;
  }
  if (/^\d{2}-\d{2}-\d{2}$/.test(text)) {
    const [month, day, year] = text.split('-');
    const yearNumber = Number(year);
    const prefix = yearNumber >= 70 ? '19' : '20';
    return `${prefix}${year}-${month}-${day}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return text;
}

function parseSeriesInfo(metadata?: AudibleMetadataEntry): BookSeriesInfo | undefined {
  const entry = metadata?.series?.[0];
  if (!entry) {
    return undefined;
  }
  const name = cleanText(entry.name ?? undefined);
  const numberMatch = cleanText(entry.part ?? undefined)?.match(/([\d.]+)/);
  const number = numberMatch?.[1];
  if (!name && !number) {
    return undefined;
  }
  return {
    name,
    number,
  };
}

function extractTags(document: Document, metadata?: AudibleMetadataEntry): string[] {
  const tags = new Set<string>();
  document.querySelectorAll('adbl-chip-group[slot="chips"] adbl-chip').forEach((chip) => {
    const text = cleanText(chip.textContent ?? undefined);
    if (text) {
      tags.add(text);
    }
  });
  (metadata?.categories ?? []).forEach((category) => {
    const text = cleanText(category?.name ?? undefined);
    if (text) {
      tags.add(text);
    }
  });
  return Array.from(tags);
}

function extractDescription(document: Document): string | undefined {
  return (
    cleanText(textFrom(document.querySelector('[data-testid="product-details-description"]'))) ||
    cleanText(document.querySelector('adbl-product-details adbl-text-block[slot="summary"]')?.textContent ?? undefined) ||
    cleanText(metaContent(document, 'meta[property="og:description"]')) ||
    cleanText(metaContent(document, 'meta[name="description"]'))
  );
}

function extractTitle(document: Document): string | undefined {
  return (
    cleanText(textFrom(document.querySelector('h1[data-testid="hero-title-block__title"]'))) ||
    cleanText(textFrom(document.querySelector('h1[slot="title"]'))) ||
    cleanText(textFrom(document.querySelector('header h1'))) ||
    cleanText(metaContent(document, 'meta[property="og:title"]')) ||
    cleanText(metaContent(document, 'meta[name="title"]'))
  );
}

function extractCoverImage(document: Document): string | undefined {
  return (
    document.querySelector('[data-testid="hero-art"] img')?.getAttribute('src') ||
    document.querySelector('adbl-product-image img')?.getAttribute('src') ||
    metaContent(document, 'meta[property="og:image"]') ||
    undefined
  );
}

function extractRuntimeText(
  document: Document,
  metadata?: AudibleMetadataEntry,
): string | undefined {
  return (
    cleanText(metadata?.duration ?? undefined) ||
    textFrom(document.querySelector('[data-testid="runtime"] span span')) ||
    undefined
  );
}

function extractPublisher(
  document: Document,
  metadata?: AudibleMetadataEntry,
): string | undefined {
  return (
    cleanText(metadata?.publisher?.name ?? undefined) ||
    textFrom(document.querySelector('[data-testid="publisher"] span span')) ||
    undefined
  );
}

function extractReleaseDate(
  document: Document,
  metadata?: AudibleMetadataEntry,
): string | undefined {
  const raw =
    metadata?.releaseDate ?? textFrom(document.querySelector('[data-testid="release-date"] span span'));
  return normalizeReleaseDate(raw ?? undefined);
}

function extractAsin(document: Document, url: URL): string | undefined {
  const candidates = Array.from(document.querySelectorAll('[data-asin]')).map((node) =>
    node.getAttribute('data-asin')?.trim(),
  );
  for (const candidate of candidates) {
    if (candidate && /^[A-Z0-9]{10}$/i.test(candidate)) {
      return candidate.toUpperCase();
    }
  }
  const segments = url.pathname.split('/').filter(Boolean);
  for (const segment of segments.reverse()) {
    if (/^[A-Z0-9]{10}$/i.test(segment)) {
      return segment.toUpperCase();
    }
  }
  return undefined;
}

async function parseAudible(context: ParserContext): Promise<ScrapedBook | null> {
  const { document, url, options } = context;
  debugLog(options, 'Parsing Audible page', url.toString());

  const title = extractTitle(document);
  if (!title) {
    debugLog(options, 'Unable to locate title on Audible page; aborting');
    return null;
  }

  const metadataEntries = collectMetadataEntries(document, options);
  debugLog(options, 'Discovered Audible metadata scripts', metadataEntries.length);
  const heroMetadata = findHeroMetadata(metadataEntries);
  const detailsMetadata = findDetailsMetadata(metadataEntries);

  const authors =
    namesFromMetadata(heroMetadata?.authors) ??
    namesFromSelector(document, 'li[data-testid="author-info"] a') ??
    [];
  const narrators =
    namesFromMetadata(heroMetadata?.narrators) ??
    namesFromSelector(document, 'li[data-testid="narrator-info"] a') ??
    [];

  const description = extractDescription(document);
  const coverImage = extractCoverImage(document);
  const runtimeText = extractRuntimeText(document, detailsMetadata);
  const publisher = extractPublisher(document, detailsMetadata);
  const publishDate = extractReleaseDate(document, detailsMetadata);
  const tags = extractTags(document, detailsMetadata);
  const series = parseSeriesInfo(detailsMetadata);
  const asin = extractAsin(document, url);

  const parsed: ScrapedBook = {
    source: 'audible',
    sourceUrl: url.toString(),
    title,
    authors,
    narrators,
    description,
    coverImage: coverImage ?? undefined,
    identifiers: {
      asin,
    },
    publisher,
    publishDate,
    pageCount: runtimeText ? toNumber(runtimeText) : undefined,
    series,
    tags,
  };

  debugLog(options, 'Parsed Audible metadata', {
    title: parsed.title,
    asin: parsed.identifiers.asin,
    tags: parsed.tags,
  });
  return parsed;
}

export const audibleParser: BookParser = {
  id: 'audible',
  matches: (url) => url.hostname.includes('audible.'),
  parse: parseAudible,
};
