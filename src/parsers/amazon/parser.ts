import { cleanText, metaContent, textFrom, toNumber } from '../../common/dom';
import { ScrapedBook } from '../../types/book';
import { BookParser } from '../base';

function extractAsin(document: Document): string | undefined {
  const asinInput = document.getElementById('ASIN') as HTMLInputElement | null;
  if (asinInput?.value) {
    return asinInput.value;
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

function parseDetailTable(document: Document): Record<string, string> {
  const map: Record<string, string> = {};
  document.querySelectorAll('#detailBullets_feature_div li span').forEach((node) => {
    const text = node.textContent?.trim();
    if (!text) return;
    const parts = text.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim().toLowerCase();
      const value = parts.slice(1).join(':').trim();
      map[key] = value;
    }
  });
  return map;
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

  const coverImage =
    document.querySelector('#ebooksImgBlkFront')?.getAttribute('src') ||
    document.querySelector('#imgBlkFront')?.getAttribute('src') ||
    metaContent(document, 'meta[name="twitter:image"]');

  const detailMap = parseDetailTable(document);

  const isbn10 = detailMap['isbn-10'];
  const isbn13 = detailMap['isbn-13'];
  const publisherInfo = detailMap['publisher'];
  const printLength = detailMap['print length'];
  const publicationDate = publisherInfo?.match(/\(([^)]+)\)/)?.[1];
  const publisher = publisherInfo?.split('(')[0].trim();

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
      asin: extractAsin(document),
      amazonId: extractAsin(document),
      isbn10,
      isbn13,
    },
    publisher,
    publishDate: publicationDate,
    pageCount: toNumber(printLength),
    series: undefined,
    tags: [],
  };
}

export const amazonParser: BookParser = {
  id: 'amazon',
  matches: (url) => url.hostname.includes('amazon.'),
  parse: async ({ document, url }) => parseAmazon(document, url),
};
