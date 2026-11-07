import { describe, expect, it, vi } from 'vitest';
import { ArticleImageService, extractOgImage } from './article-image-service.js';

describe('article image metadata lookup', () => {
    it('extracts og:image regardless of attribute order and resolves relative URLs', () => {
        expect(extractOgImage('<meta content="../photo.jpg?x=1&amp;y=2" property="og:image">', 'https://news.example/path/story'))
            .toBe('https://news.example/photo.jpg?x=1&y=2');
        expect(extractOgImage('<meta property="og:image" content="javascript:alert(1)">', 'https://news.example/story')).toBeNull();
    });

    it('caches successful images and misses for 24 hours', async () => {
        let now = 100;
        const fetchPage: typeof fetch = vi.fn(async () => new Response(
            '<meta property="og:image" content="/photo.jpg">',
            { headers: { 'content-type': 'text/html' } },
        ));
        const service = new ArticleImageService(fetchPage, () => now);
        const url = 'https://news.example/story';

        expect(await service.getImage(url)).toBe('https://news.example/photo.jpg');
        expect(await service.getImage(url)).toBe('https://news.example/photo.jpg');
        expect(fetchPage).toHaveBeenCalledTimes(1);

        now += 24 * 60 * 60 * 1000;
        expect(await service.getImage(url)).toBe('https://news.example/photo.jpg');
        expect(fetchPage).toHaveBeenCalledTimes(2);
    });

    it('keeps at most five page fetches active and rejects private URLs', async () => {
        let active = 0;
        let peakActive = 0;
        const fetchPage: typeof fetch = vi.fn(async () => {
            active += 1;
            peakActive = Math.max(peakActive, active);
            await new Promise((resolve) => setTimeout(resolve, 2));
            active -= 1;
            return new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
        });
        const service = new ArticleImageService(fetchPage);

        await expect(service.getImage('http://127.0.0.1/private')).rejects.toThrow('not safe');
        await Promise.all(Array.from({ length: 8 }, (_, index) => service.getImage(`https://news.example/${index}`)));

        expect(peakActive).toBe(5);
        expect(fetchPage).toHaveBeenCalledTimes(8);
    });
});
