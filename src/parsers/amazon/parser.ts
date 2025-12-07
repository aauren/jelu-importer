import { cleanText, metaContent, textFrom, toNumber } from '../../common/dom';
import { createDebugLogger } from '../../common/logger';
import { BookSeriesInfo, ScrapedBook } from '../../types/book';
import { BookParser, ParserContext } from '../base';

const debugLog = createDebugLogger('amazon');

function extractAsin(document: Document): string | undefined {
  const asinInput = document.getElementById('ASIN') as HTMLInputElement | null;
  if (asinInput?.value) {
    return asinInput.value;
  }
  const dataAsin = document.querySelector('[data-asin]')?.getAttribute('data-asin');
  if (dataAsin) {
    return dataAsin;
  }
  const bullets = document.querySelectorAll('#detailBullets_feature_div li');
  for (const item of bullets) {
    const text = item.textContent?.trim();
    if (!text) continue;
    const match = text.match(/ASIN\s*:\s*(\w+)/i);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

function parseDetailEntries(document: Document): Record<string, string> {
  const map: Record<string, string> = {};
  const addEntry = (key?: string | null, value?: string | null) => {
    const normalizedKey = key?.trim().toLowerCase();
    const normalizedValue = cleanText(value ?? undefined);
    if (normalizedKey && normalizedValue) {
      map[normalizedKey] = normalizedValue;
    }
  };

  const bulletLists = [
    ...Array.from(document.querySelectorAll('#detailBullets_feature_div li')),
    ...Array.from(document.querySelectorAll('#detailBulletsWrapper_feature_div li')),
  ];
  bulletLists.forEach((item) => {
    const label = cleanText(item.querySelector('.a-text-bold')?.textContent);
    const text = cleanText(item.textContent);
    if (label && text) {
      addEntry(label.replace(/[:：]/g, ''), text.replace(label, ''));
    } else if (text) {
      const parts = text.split(':');
      if (parts.length >= 2) {
        addEntry(parts[0], parts.slice(1).join(':'));
      }
    }
  });

  document.querySelectorAll('#productDetailsTable tr, #productDetails_detailBullets_sections1 tr').forEach((row) => {
    const header = cleanText(row.querySelector('th')?.textContent);
    const value = cleanText(row.querySelector('td')?.textContent);
    addEntry(header, value);
  });

  return map;
}

interface RichProductAttribute {
  label?: string;
  value?: string;
}

function parseRichProductInfo(document: Document): Record<string, RichProductAttribute> {
  const map: Record<string, RichProductAttribute> = {};
  document.querySelectorAll<HTMLElement>('[data-rpi-attribute-name]').forEach((node) => {
    const key = node.dataset.rpiAttributeName;
    const label = cleanText(node.querySelector('.rpi-attribute-label')?.textContent ?? undefined);
    const value = cleanText(node.querySelector('.rpi-attribute-value')?.textContent ?? undefined);
    if (key && (label || value)) {
      map[key] = { label, value };
    }
  });
  return map;
}

function parseSeriesInfo(attributes: Record<string, RichProductAttribute>): BookSeriesInfo | undefined {
  const seriesAttr = attributes['book_details-series'];
  if (!seriesAttr?.value) {
    return undefined;
  }
  const numberMatch = seriesAttr.label?.match(/Book\s+([\d.]+)/i);
  return {
    name: seriesAttr.value,
    number: numberMatch?.[1],
  };
}

function extractTags(document: Document): string[] {
  const selectors = [
    '#wayfinding-breadcrumbs_feature_div a',
    '#ebooksSubtitleBreadcrumb a',
    '#bylineInfo_feature_div a.a-link-normal',
  ];
  const blacklist = new Set(['books', 'kindle store', 'kindle ebooks']);
  const tags = new Set<string>();
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      const text = cleanText(node.textContent ?? undefined);
      if (text) {
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (normalized && !blacklist.has(normalized.toLowerCase())) {
          tags.add(normalized);
        }
      }
    });
  });
  return Array.from(tags);
}

function normalizeDate(value?: string): string | undefined {
  const text = cleanText(value ?? undefined);
  if (!text) {
    return undefined;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return text;
}

async function parseAmazon(context: ParserContext): Promise<ScrapedBook | null> {
  const { document, url, options } = context;
  debugLog(options, 'Parsing Amazon page', url.toString());
  const title = cleanText(textFrom(document.getElementById('productTitle')));
  if (!title) {
    debugLog(options, 'Unable to locate product title; aborting parse');
    return null;
  }
  const contributors = Array.from(
    document.querySelectorAll('#bylineInfo span.author a, .contributorNameID'),
  )
    .map((el) => el.textContent?.trim())
    .filter((name): name is string => Boolean(name));

  const description = cleanText(
    textFrom(document.querySelector('#bookDescription_feature_div noscript')) ||
      textFrom(document.querySelector('#bookDescription_feature_div')),
  );

  const coverImage = getCoverImage(document);

  const detailMap = parseDetailEntries(document);
  const richAttributes = parseRichProductInfo(document);

  const isbn10 = detailMap['isbn-10'];
  const isbn13 = detailMap['isbn-13'];
  const publisherInfo = richAttributes['book_details-publisher']?.value ?? detailMap['publisher'];
  const printLength =
    richAttributes['book_details-ebook_pages']?.value ??
    richAttributes['book_details-print_length']?.value ??
    detailMap['print length'];
  const publicationText =
    richAttributes['book_details-publication_date']?.value ??
    detailMap['publication date'] ??
    detailMap['publication date‏‎'];

  const publisher = publisherInfo?.split('(')[0].trim();
  let publishDate: string | undefined = publicationText;
  if (!publishDate && publisherInfo?.includes('(')) {
    const match = publisherInfo.match(/\(([^)]+)\)/);
    if (match) {
      publishDate = match[1];
    }
  }
  publishDate = normalizeDate(publishDate);

  const asin = extractAsin(document) ?? detailMap['asin'];
  const tags = extractTags(document);

  const parsed: ScrapedBook = {
    source: 'amazon',
    sourceUrl: url.toString(),
    title,
    subtitle: undefined,
    authors: contributors,
    narrators: undefined,
    description,
    coverImage: coverImage ?? undefined,
    identifiers: {
      asin,
      amazonId: asin,
      isbn10,
      isbn13,
    },
    publisher,
    publishDate: publishDate ?? undefined,
    pageCount: toNumber(printLength),
    series: parseSeriesInfo(richAttributes),
    tags,
  };
  debugLog(options, 'Parsed Amazon metadata', {
    title: parsed.title,
    asin: parsed.identifiers.asin,
    isbn13: parsed.identifiers.isbn13,
  });
  return parsed;
}

export const amazonParser: BookParser = {
  id: 'amazon',
  matches: (url) => url.hostname.includes('amazon.'),
  parse: parseAmazon,
};

function normalizeImageUrl(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const stripped = value.replace(/^url\((.*)\)$/i, '$1').trim().replace(/^['"]|['"]$/g, '');
  if (!stripped) {
    return undefined;
  }
  if (stripped.startsWith('//')) {
    return `https:${stripped}`;
  }
  return stripped;
}

function pickSrcsetCandidate(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!entries.length) {
    return undefined;
  }
  const last = entries[entries.length - 1];
  const [url] = last.split(/\s+/);
  return url;
}

function parseDynamicImageData(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value) as Record<string, [number, number] | number[]>;
    const entries = Object.entries(parsed);
    if (!entries.length) {
      return undefined;
    }
    entries.sort(([, sizeA], [, sizeB]) => {
      const area = (size?: [number, number] | number[]) =>
        Array.isArray(size) && size.length >= 2 ? Number(size[0]) * Number(size[1]) : 0;
      return area(sizeB) - area(sizeA);
    });
    return entries[0][0];
  } catch (error) {
    console.warn('Failed to parse Amazon dynamic image metadata', error);
    return undefined;
  }
}

function extractFromImage(img?: HTMLImageElement | null): string | undefined {
  if (!img) {
    return undefined;
  }
  const candidates = [
    img.currentSrc,
    img.getAttribute('data-old-hires'),
    img.getAttribute('data-old-highres'),
    img.getAttribute('data-old-src'),
    img.getAttribute('data-hires'),
    img.getAttribute('src'),
    pickSrcsetCandidate(img.getAttribute('srcset')),
    img.getAttribute('data-src'),
    parseDynamicImageData(img.getAttribute('data-a-dynamic-image')),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeImageUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function extractBackgroundImage(element: Element | null): string | undefined {
  if (!element) {
    return undefined;
  }
  const style = element.getAttribute('style');
  if (!style) {
    return undefined;
  }
  const match = style.match(/background-image\s*:\s*url\(([^)]+)\)/i);
  if (!match) {
    return undefined;
  }
  return normalizeImageUrl(match[1]);
}

function extractImageSource(element: Element | null): string | undefined {
  if (!element) {
    return undefined;
  }
  if (element instanceof HTMLImageElement) {
    const direct = extractFromImage(element);
    if (direct) {
      return direct;
    }
  }
  const nested = element.querySelector('img');
  if (nested) {
    const nestedSrc = extractFromImage(nested);
    if (nestedSrc) {
      return nestedSrc;
    }
  }
  const background = extractBackgroundImage(element);
  if (background) {
    return background;
  }
  const dynamic = parseDynamicImageData(element.getAttribute('data-a-dynamic-image'));
  if (dynamic) {
    return dynamic;
  }
  return undefined;
}

function getCoverImage(document: Document): string | undefined {
  const selectors = [
    '#ebooksImgBlkFront',
    '#imgBlkFront',
    '#landingImage',
    '#imgTagWrapperId img',
    '#imageBlock_feature_div img',
    '#ebooksImageBlockContainer img',
    '#main-image-container img',
    '#image-canvas img',
    '#img-canvas img',
  ];
  for (const selector of selectors) {
    const candidate = extractImageSource(document.querySelector(selector));
    if (candidate) {
      return candidate;
    }
  }

  const dynamicImageNode = document.querySelector('[data-a-dynamic-image]');
  const dynamicCandidate = extractImageSource(dynamicImageNode);
  if (dynamicCandidate) {
    return dynamicCandidate;
  }

  return (
    metaContent(document, 'meta[name="twitter:image"]') ??
    metaContent(document, 'meta[property="og:image"]') ??
    undefined
  );
}
