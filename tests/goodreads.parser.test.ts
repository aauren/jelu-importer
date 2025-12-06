import { readFileSync } from 'fs';
import { resolve } from 'path';
import { goodreadsParser } from '../src/parsers/goodreads/parser';

function createDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('goodreads parser', () => {
  it('extracts metadata from simplified markup', async () => {
    const doc = createDocument(`
      <div id="bookTitle">Test Book</div>
      <div id="bookAuthors"><span itemprop="name">Author One</span></div>
      <div id="description"><span>Great book.</span></div>
      <img id="coverImage" src="https://example.com/cover.jpg" />
      <span itemprop="numberOfPages">350 pages</span>
      <div id="bookSeries"><a>Series Name</a> #2</div>
      <div class="left"><a class="bookPageGenreLink">Fantasy</a></div>
    `);

    const result = await goodreadsParser.parse({
      document: doc,
      url: new URL('https://www.goodreads.com/book/show/12345-test-book'),
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Test Book');
    expect(result?.authors).toEqual(['Author One']);
    expect(result?.series?.name).toContain('Series Name');
    expect(result?.tags).toContain('Fantasy');
  });

  it('parses structured data embedded in __NEXT_DATA__ script', async () => {
    const html = readFileSync(
      resolve(__dirname, 'fixtures/goodreads_next_data.html'),
      'utf8',
    );
    const doc = createDocument(html);

    const result = await goodreadsParser.parse({
      document: doc,
      url: new URL('https://www.goodreads.com/book/show/12345.example'),
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Example Book: A Tale');
    expect(result?.authors).toEqual(['Primary Author', 'Second Author']);
    expect(result?.identifiers.goodreadsId).toBe('12345');
    expect(result?.identifiers.asin).toBe('B012345678');
    expect(result?.tags).toEqual(['Fantasy', 'Adventure']);
    expect(result?.series?.name).toBe('Series Title');
    expect(result?.series?.number).toBe('2');
    expect(result?.publishDate).toBe('2024-02-18');
    expect(result?.pageCount).toBe(420);
  });
});
