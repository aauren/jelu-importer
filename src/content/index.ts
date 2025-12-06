import browser from 'webextension-polyfill';
import { findParser } from '../parsers';
import { ParserContext } from '../parsers/base';
import { ScrapedBook } from '../types/book';

async function handleScrapeRequest(): Promise<ScrapedBook | null> {
  const url = new URL(window.location.href);
  const parser = findParser(url);
  if (!parser) {
    return null;
  }

  const context: ParserContext = {
    document,
    url,
  };

  try {
    const result = await parser.parse(context);
    return result;
  } catch (error) {
    console.error('Failed to parse page', error);
    return null;
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === 'SCRAPE_PAGE') {
    return handleScrapeRequest();
  }
  return undefined;
});
