import { amazonParser } from '../src/parsers/amazon/parser';

function createDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('amazon parser', () => {
  it('extracts structured details from rich product info', async () => {
    const doc = createDocument(`
      <div id="wayfinding-breadcrumbs_feature_div">
        <ul><li><a>Kindle Store</a></li><li><a>Fantasy</a></li></ul>
      </div>
      <div id="productTitle">Sample Book</div>
      <div id="bylineInfo">
        <span class="author"><a>Author One</a></span>
        <span class="author"><a>Author Two</a></span>
      </div>
      <div id="bookDescription_feature_div"><div>A gripping tale.</div></div>
      <img id="ebooksImgBlkFront" src="https://example.com/cover.jpg" />
      <input id="ASIN" value="B000TESTASIN" />
      <div id="detailBullets_feature_div">
        <ul>
          <li>
            <span class="a-text-bold">Publisher :</span>
            <span>Example House (January 1, 2020)</span>
          </li>
          <li>
            <span class="a-text-bold">ISBN-10 :</span>
            <span>1234567890</span>
          </li>
          <li>
            <span class="a-text-bold">ISBN-13 :</span>
            <span>978-1234567890</span>
          </li>
        </ul>
      </div>
      <div id="rich_product_information">
        <div data-rpi-attribute-name="book_details-ebook_pages">
          <div class="rpi-attribute-value"><span>512 pages</span></div>
        </div>
        <div data-rpi-attribute-name="book_details-publication_date">
          <div class="rpi-attribute-value"><span>February 2, 2021</span></div>
        </div>
        <div data-rpi-attribute-name="book_details-series">
          <div class="rpi-attribute-label"><span>Book 3 of 5</span></div>
          <div class="rpi-attribute-value"><a>Legends Saga</a></div>
        </div>
      </div>
    `);

    const result = await amazonParser.parse({
      document: doc,
      url: new URL('https://www.amazon.com/gp/product/B000TESTASIN'),
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Sample Book');
    expect(result?.authors).toEqual(['Author One', 'Author Two']);
    expect(result?.identifiers.asin).toBe('B000TESTASIN');
    expect(result?.identifiers.isbn10).toBe('1234567890');
    expect(result?.identifiers.isbn13).toBe('978-1234567890');
    expect(result?.publisher).toBe('Example House');
    expect(result?.publishDate).toBe('2021-02-02');
    expect(result?.pageCount).toBe(512);
    expect(result?.series?.name).toBe('Legends Saga');
    expect(result?.series?.number).toBe('3');
    expect(result?.tags).toContain('Fantasy');
  });

  it('captures cover images from extended Amazon attributes', async () => {
    const doc = createDocument(`
      <div id="productTitle">Image Test</div>
      <div id="bookDescription_feature_div"><div>desc</div></div>
      <div id="imageBlock_feature_div">
        <img
          id="landingImage"
          srcset="https://example.com/cover-small.jpg 1x, https://example.com/cover-large.jpg 2x"
          data-old-hires="https://example.com/cover-hires.jpg"
        />
      </div>
    `);

    const result = await amazonParser.parse({
      document: doc,
      url: new URL('https://www.amazon.com/gp/product/B000TESTASIN'),
    });

    expect(result?.coverImage).toBe('https://example.com/cover-hires.jpg');
  });

  it('falls back to data-a-dynamic-image metadata for covers', async () => {
    const doc = createDocument(`
      <div id="productTitle">Dynamic Image</div>
      <div id="bookDescription_feature_div"><div>desc</div></div>
      <div data-a-dynamic-image='{"https://example.com/dynamic.jpg":[500,500]}'></div>
    `);

    const result = await amazonParser.parse({
      document: doc,
      url: new URL('https://www.amazon.com/gp/product/B000TESTASIN'),
    });

    expect(result?.coverImage).toBe('https://example.com/dynamic.jpg');
  });
});
