import { googleBooksParser } from '../src/parsers/google/parser';

function createDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('google books parser', () => {
  it('parses structured info from Google Books pages', async () => {
    const doc = createDocument(`
      <div class="UDZeY">Sample Google Title</div>
      <div jsname="bN97Pc">A capsule description.</div>
      <meta property="og:image" content="https://example.com/cover.jpg" />
      <div class="KJcZOe">
        <span class="aIX766">Author One</span>
        <span class="aIX766">Author Two</span>
      </div>
      <div class="kc7Grd">
        <div class="w8qArf">Publisher</div>
        <div class="LrzXr">Example Press</div>
      </div>
      <div class="kc7Grd">
        <div class="w8qArf">Published</div>
        <div class="LrzXr">January 1, 2021</div>
      </div>
      <div class="kc7Grd">
        <div class="w8qArf">ISBN 10</div>
        <div class="LrzXr">0123456789</div>
      </div>
      <div class="kc7Grd">
        <div class="w8qArf">ISBN 13</div>
        <div class="LrzXr">9780123456789</div>
      </div>
      <div class="kc7Grd">
        <div class="w8qArf">Length</div>
        <div class="LrzXr">384 pages</div>
      </div>
    `);

    const result = await googleBooksParser.parse({
      document: doc,
      url: new URL('https://books.google.com/books/about?id=test'),
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Sample Google Title');
    expect(result?.authors).toEqual(['Author One', 'Author Two']);
    expect(result?.publisher).toBe('Example Press');
    expect(result?.publishDate).toBe('January 1, 2021');
    expect(result?.identifiers.isbn10).toBe('0123456789');
    expect(result?.identifiers.isbn13).toBe('9780123456789');
    expect(result?.pageCount).toBe(384);
    expect(result?.coverImage).toBe('https://example.com/cover.jpg');
  });

  it('parses the newer metadata layout served from google.com/books', async () => {
    const doc = createDocument(`
      <div class="booktitle"><span class="fn">Modern UI Title</span></div>
      <div id="synopsistext">New layout description</div>
      <div class="bookinfo_sectionwrap">
        <div>
          <a class="secondary"><span>Author Alpha</span></a>
          <a class="secondary"><span>Author Beta</span></a>
        </div>
      </div>
      <table id="metadata_content_table">
        <tr class="metadata_row">
          <td class="metadata_label">Publisher</td>
          <td class="metadata_value">Example Press, March 3, 2020</td>
        </tr>
        <tr class="metadata_row">
          <td class="metadata_label">ISBN</td>
          <td class="metadata_value">1111111111, 9781111111111</td>
        </tr>
        <tr class="metadata_row">
          <td class="metadata_label">Length</td>
          <td class="metadata_value">432 pages</td>
        </tr>
        <tr class="metadata_row">
          <td class="metadata_label">Subjects</td>
          <td class="metadata_value">
            <a>Fantasy</a> › <a>Epic</a>
          </td>
        </tr>
      </table>
    `);

    const result = await googleBooksParser.parse({
      document: doc,
      url: new URL('https://www.google.com/books/edition/_/abc?hl=en'),
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Modern UI Title');
    expect(result?.authors).toEqual(['Author Alpha', 'Author Beta']);
    expect(result?.publisher).toBe('Example Press');
    expect(result?.publishDate).toBe('March 3, 2020');
    expect(result?.identifiers.isbn10).toBe('1111111111');
    expect(result?.identifiers.isbn13).toBe('9781111111111');
    expect(result?.pageCount).toBe(432);
    expect(result?.tags).toEqual(['Fantasy', 'Epic']);
    expect(result?.description).toBe('New layout description');
  });

  it('extracts publisher dates, series, and page counts from condensed metadata rows', async () => {
    const doc = createDocument(`
      <div class="booktitle">
        <span class="fn">Magician</span>
      </div>
      <table id="metadata_content_table">
        <tr class="metadata_row">
          <td class="metadata_label">Title</td>
          <td class="metadata_value">
            <span>Magician</span><br/>
            <a class="primary">Book 1 of Riftwar Saga Series</a>
          </td>
        </tr>
        <tr class="metadata_row">
          <td class="metadata_label">Publisher</td>
          <td class="metadata_value">Harper Voyager, 2012 - Fiction - 841 pages</td>
        </tr>
      </table>
    `);

    const result = await googleBooksParser.parse({
      document: doc,
      url: new URL('https://www.google.com/books/edition/Magician/5LImpwAACAAJ?hl=en'),
    });

    expect(result?.publisher).toBe('Harper Voyager');
    expect(result?.publishDate).toBe('2012');
    expect(result?.pageCount).toBe(841);
    expect(result?.series?.name).toBe('Riftwar Saga Series');
    expect(result?.series?.number).toBe('1');
  });

  it('matches both books.google.* and the google.com/books experience', () => {
    expect(
      googleBooksParser.matches(new URL('https://books.google.com/books/about?id=abc')),
    ).toBe(true);
    expect(
      googleBooksParser.matches(new URL('https://www.google.com/books/edition/_/abc?hl=en')),
    ).toBe(true);
    expect(googleBooksParser.matches(new URL('https://www.google.com/'))).toBe(false);
  });

  it('falls back to the Google Books API when the DOM is missing metadata', async () => {
    const doc = createDocument('<html><body></body></html>');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        volumeInfo: {
          title: 'Fallback Title',
          authors: ['Author API'],
          description: '<p>API description</p>',
          industryIdentifiers: [
            { type: 'ISBN_10', identifier: '1111111111' },
            { type: 'ISBN_13', identifier: '9781111111111' },
          ],
          publisher: 'API Publisher',
          publishedDate: '2020-05-05',
          categories: ['Fantasy', 'Adventure'],
          imageLinks: {
            thumbnail: 'http://example.com/image.jpg',
          },
          pageCount: 512,
        },
      }),
    } as unknown as Response);
    const originalFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = fetchMock;

    const result = await googleBooksParser.parse({
      document: doc,
      url: new URL('https://www.google.com/books/edition/Magician/5LImpwAACAAJ?hl=en'),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/books/v1/volumes/5LImpwAACAAJ',
    );
    expect(result?.title).toBe('Fallback Title');
    expect(result?.authors).toEqual(['Author API']);
    expect(result?.identifiers.isbn13).toBe('9781111111111');
    expect(result?.tags).toEqual(['Fantasy', 'Adventure']);
    expect(result?.coverImage).toBe('https://example.com/image.jpg');

    if (originalFetch) {
      (globalThis as any).fetch = originalFetch;
    } else {
      delete (globalThis as any).fetch;
    }
  });
});
