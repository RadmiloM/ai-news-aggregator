import { describe, expect, it, vi } from 'vitest';
import { Article } from '../types/article.js';
import { NewsProvider } from '../providers/news-provider.js';
import { NewsFeedService } from './news-feed-service.js';

const now = Date.parse('2026-11-07T12:00:00.000Z');
const story: Article = {
    id: 'one', title: 'Climate talks open in Geneva', summary: 'Leaders arrive.', source: 'BBC', sources: ['BBC'],
    url: 'https://news.example/1', imageUrl: null, publishedAt: new Date(now - 1000).toISOString(), category: 'world',
};

describe('NewsFeedService', () => {
    it('returns successful sources when another provider fails and caches the result', async () => {
        let time = now;
        const first: NewsProvider = { name: 'BBC', fetchArticles: vi.fn(async () => [story]) };
        const down: NewsProvider = { name: 'Reuters', fetchArticles: vi.fn(async () => { throw new Error('offline'); }) };
        const service = new NewsFeedService([first, down], 600_000, () => time);
        const result = await service.getNews();
        const cached = await service.getNews();
        expect(result.articles).toHaveLength(1);
        expect(result.sourceStatus).toEqual([{ name: 'BBC', ok: true, count: 1 }, { name: 'Reuters', ok: false, count: 0 }]);
        expect(cached).toBe(result);
        expect(first.fetchArticles).toHaveBeenCalledTimes(1);
        time += 600_001;
        await service.getNews();
        expect(first.fetchArticles).toHaveBeenCalledTimes(2);
    });

    it('coalesces concurrent fetches', async () => {
        let resolveFeed!: (articles: Article[]) => void;
        const provider: NewsProvider = { name: 'BBC', fetchArticles: () => new Promise((resolve) => { resolveFeed = resolve; }) };
        const service = new NewsFeedService([provider], 600_000, () => now);
        const first = service.getNews();
        const second = service.getNews();
        resolveFeed([story]);
        expect(await first).toBe(await second);
    });
});
