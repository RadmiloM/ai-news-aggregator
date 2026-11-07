import { afterEach, describe, expect, it, vi } from 'vitest';
import { RssProvider } from './rss-provider.js';

afterEach(() => vi.unstubAllGlobals());

describe('RssProvider request behavior', () => {
  it('sends RSS headers, logs failed response details, and retries once', async () => {
    const xml = '<rss version="2.0"><channel><title>Test</title></channel></rss>';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('Access denied', { status: 403, statusText: 'Forbidden', headers: { 'x-feed-error': 'blocked' } }))
      .mockResolvedValueOnce(new Response(xml, { headers: { 'content-type': 'application/rss+xml' } }));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', fetchMock);

    await new RssProvider('Guardian World', 'https://www.theguardian.com/world/rss').fetchArticles();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith('https://www.theguardian.com/world/rss', expect.objectContaining({
      headers: { 'user-agent': 'Mozilla/5.0 NewsAggregator/1.0', accept: 'application/rss+xml' },
      signal: expect.any(AbortSignal),
    }));
    expect(errorLog).toHaveBeenCalledWith('RSS feed request failed', expect.objectContaining({
      source: 'Guardian World',
      status: 403,
      error: expect.stringContaining('HTTP 403 Forbidden: Access denied'),
      headers: expect.objectContaining({ 'x-feed-error': 'blocked' }),
    }));
    errorLog.mockRestore();
  });
});

describe('RssProvider image extraction', () => {
  it('parses a saved Guardian-style sample with HTML descriptions and picks the widest media image', async () => {
    const xml = await (await import('node:fs/promises')).readFile(new URL('./fixtures/guardian-world-sample.xml', import.meta.url), 'utf8');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(xml, { headers: { 'content-type': 'application/rss+xml' } })));

    const articles = await new RssProvider('Guardian World', 'https://www.theguardian.com/world/rss').fetchArticles();

    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      title: 'Sample Guardian world headline',
      summary: 'Synthetic report text with an HTML description.',
      imageUrl: 'https://images.example/guardian-large.jpg',
    });
  });

    it('checks media content, thumbnail, image enclosure, then the first content or description image', async () => {
        const xml = `<?xml version="1.0"?>
            <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
              <channel><title>Test</title><link>https://news.example/</link>
                <item><title>Media content</title><link>https://news.example/1</link>
                  <media:content url="/media-content.jpg" medium="image" />
                  <media:thumbnail url="/thumbnail.jpg" />
                  <enclosure url="/enclosure.jpg" type="image/jpeg" />
                  <content:encoded><![CDATA[<img src="/encoded.jpg">]]></content:encoded>
                </item>
                <item><title>Thumbnail</title><link>https://news.example/2</link>
                  <media:thumbnail url="/thumbnail.jpg" />
                  <enclosure url="/enclosure.jpg" type="image/jpeg" />
                </item>
                <item><title>Image enclosure</title><link>https://news.example/3</link>
                  <enclosure url="/enclosure.jpg" type="image/jpeg" />
                </item>
                <item><title>Text enclosure</title><link>https://news.example/4</link>
                  <enclosure url="/document.pdf" type="application/pdf" />
                  <content:encoded><![CDATA[<img data-src="/wrong.jpg" src="/first.jpg"><img src="/second.jpg">]]></content:encoded>
                </item>
                <item><title>Description image</title><link>https://news.example/5</link>
                  <description><![CDATA[<img src="/description.jpg">]]></description>
                </item>
              </channel>
            </rss>`;
        vi.stubGlobal('fetch', vi.fn(async () => new Response(xml, { headers: { 'content-type': 'application/rss+xml' } })));

        const articles = await new RssProvider('Test News', 'https://news.example/feed.xml').fetchArticles();

        expect(articles.map((article) => article.imageUrl)).toEqual([
            'https://news.example/media-content.jpg',
            'https://news.example/thumbnail.jpg',
            'https://news.example/enclosure.jpg',
            'https://news.example/first.jpg',
            'https://news.example/description.jpg',
        ]);
    });
});
