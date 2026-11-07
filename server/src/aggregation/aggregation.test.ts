import { describe, expect, it } from 'vitest';
import { deduplicateArticles, normalizedHeadline } from './deduplicate.js';
import { rankArticles, withinLast24Hours } from './rank.js';
import { Article } from '../types/article.js';

const now = Date.parse('2026-11-07T12:00:00.000Z');

function article(overrides: Partial<Article> = {}): Article {
    return {
        id: 'one', title: 'Major climate summit opens in Geneva', summary: 'A short report.', source: 'BBC News', sources: ['BBC News'],
        url: 'https://news.example/story', imageUrl: null, publishedAt: new Date(now - 60 * 60 * 1000).toISOString(), category: 'world', ...overrides,
    };
}

describe('headline normalization and deduplication', () => {
    it('normalizes punctuation and diacritics consistently', () => {
        expect(normalizedHeadline('Café: Leaders—Meet!')).toBe('cafe leaders meet');
    });

    it('merges similar headlines across publishers and counts unique sources', () => {
        const merged = deduplicateArticles([
            article(),
            article({ id: 'two', source: 'Reuters', sources: ['Reuters'], title: 'Major climate summit opens in Geneva today', url: 'https://wire.example/climate' }),
            article({ id: 'three', source: 'Reuters', sources: ['Reuters'], title: 'Major climate summit opens in Geneva today', url: 'https://wire.example/climate?utm_source=feed' }),
        ]);
        expect(merged).toHaveLength(1);
        expect(merged[0]?.sources).toEqual(['BBC News', 'Reuters']);
    });

    it('keeps unrelated stories separate', () => {
        const results = deduplicateArticles([
            article(), article({ id: 'two', title: 'Local football club wins the national cup', url: 'https://sports.example/final' }),
        ]);
        expect(results).toHaveLength(2);
    });
});

describe('ranking and Today window', () => {
    it('balances recency with unique source coverage', () => {
        const recent = article({ id: 'recent', publishedAt: new Date(now - 30 * 60 * 1000).toISOString(), sources: ['BBC News'] });
        const covered = article({ id: 'covered', publishedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(), sources: ['BBC News', 'Reuters', 'Al Jazeera', 'B92'] });
        expect(rankArticles([recent, covered], now)[0]?.id).toBe('covered');
    });

    it('uses publication time as a stable tiebreaker', () => {
        const latest = article({ id: 'latest', publishedAt: new Date(now - 20 * 60 * 1000).toISOString() });
        const earlier = article({ id: 'earlier', publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() });
        expect(rankArticles([earlier, latest], now)[0]?.id).toBe('latest');
    });

    it('includes the exact 24-hour boundary and excludes older or future items', () => {
        const boundary = article({ id: 'boundary', publishedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString() });
        const old = article({ id: 'old', publishedAt: new Date(now - 24 * 60 * 60 * 1000 - 1).toISOString() });
        const future = article({ id: 'future', publishedAt: new Date(now + 1000).toISOString() });
        expect(withinLast24Hours([boundary, old, future], now).map((item) => item.id)).toEqual(['boundary']);
    });
});
