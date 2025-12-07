import { audibleParser } from '../src/parsers/audible/parser';

function createDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('audible parser', () => {
  it('parses metadata from the modern Audible layout with metadata scripts', async () => {
    const doc = createDocument(`
      <html>
        <head>
          <meta property="og:image" content="https://example.com/cover-fallback.jpg" />
        </head>
        <body>
          <adbl-product-hero>
            <adbl-product-image slot="image">
              <img src="https://example.com/cover.jpg" />
            </adbl-product-image>
            <adbl-title-lockup slot="title-lockup">
              <h1 slot="title">Sample Audible Title</h1>
            </adbl-title-lockup>
            <adbl-product-metadata class="product-metadata" slot="metadata">
              <script type="application/json">
                {"authors":[{"name":"Author One"},{"name":"Author Two"}],"narrators":[{"name":"Narrator A"}]}
              </script>
            </adbl-product-metadata>
          </adbl-product-hero>
          <adbl-product-details class="product-details-widget-spacing">
            <adbl-text-block slot="summary">A thrilling adventure.</adbl-text-block>
            <adbl-product-metadata slot="metadata">
              <script type="application/json">
                {"duration":"10 hrs and 5 mins","releaseDate":"12-01-23","series":[{"part":"Book 2","name":"Saga"}],"publisher":{"name":"AudioPub"},"categories":[{"name":"Fantasy"},{"name":"Adventure"}]}
              </script>
            </adbl-product-metadata>
            <adbl-chip-group slot="chips">
              <adbl-chip>Epic</adbl-chip>
            </adbl-chip-group>
          </adbl-product-details>
          <div data-asin="B00TEST123"></div>
        </body>
      </html>
    `);

    const result = await audibleParser.parse({
      document: doc,
      url: new URL('https://www.audible.com/pd/Sample-Audiobook/B00TEST123'),
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Sample Audible Title');
    expect(result?.authors).toEqual(['Author One', 'Author Two']);
    expect(result?.narrators).toEqual(['Narrator A']);
    expect(result?.description).toBe('A thrilling adventure.');
    expect(result?.identifiers.asin).toBe('B00TEST123');
    expect(result?.publisher).toBe('AudioPub');
    expect(result?.publishDate).toBe('2023-12-01');
    expect(result?.series?.name).toBe('Saga');
    expect(result?.series?.number).toBe('2');
    expect(result?.tags).toEqual(expect.arrayContaining(['Fantasy', 'Adventure', 'Epic']));
  });
});
