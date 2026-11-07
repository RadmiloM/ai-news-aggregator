import { afterEach, describe, expect, it, vi } from 'vitest';
import { RssProvider } from './rss-provider.js';

afterEach(() => vi.unstubAllGlobals());

describe('RssProvider image extraction', () => {
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
