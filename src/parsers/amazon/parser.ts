import { cleanText, metaContent, textFrom, toNumber } from '../../common/dom';
import { BookSeriesInfo, ScrapedBook } from '../../types/book';
import { BookParser } from '../base';

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

async function parseAmazon(document: Document, url: URL): Promise<ScrapedBook | null> {
  const title = cleanText(textFrom(document.getElementById('productTitle')));
  if (!title) {
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

  return {
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
}

export const amazonParser: BookParser = {
  id: 'amazon',
  matches: (url) => url.hostname.includes('amazon.'),
  parse: async ({ document, url }) => parseAmazon(document, url),
};
function getCoverImage(document: Document): string | undefined {
  const selectors = ['#ebooksImgBlkFront', '#imgBlkFront', '#landingImage', '#imgTagWrapperId img'];
  for (const selector of selectors) {
    const src = document.querySelector<HTMLImageElement>(selector)?.getAttribute('src');
    if (src) {
      return src;
    }
  }

  const dynamicImageNode = document.querySelector('[data-a-dynamic-image]');
  const dynamicData = dynamicImageNode?.getAttribute('data-a-dynamic-image');
  if (dynamicData) {
    try {
      const parsed = JSON.parse(dynamicData) as Record<string, unknown>;
      const firstKey = Object.keys(parsed)[0];
      if (firstKey) {
        return firstKey;
      }
    } catch (error) {
      console.warn('Failed to parse Amazon dynamic image metadata', error);
    }
  }

  return (
    metaContent(document, 'meta[name="twitter:image"]') ??
    metaContent(document, 'meta[property="og:image"]') ??
    undefined
  );
}
