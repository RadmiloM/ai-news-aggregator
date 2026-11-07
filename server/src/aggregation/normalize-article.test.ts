import { describe, expect, it } from 'vitest';
import { normalizeArticle } from './normalize-article.js';

describe('normalizeArticle', () => {
    it('cleans publisher markup, keeps safe links, and infers a category', () => {
        const article = normalizeArticle({
            title: '<b>New AI software</b> launches for researchers',
            summary: '<p>Teams &amp; labs begin testing a new tool.</p>',
            url: 'https://news.example/ai-tool',
            imageUrl: 'https://images.example/ai.jpg',
            publishedAt: '2026-11-07T10:00:00.000Z',
        }, 'Example News');
        expect(article).toMatchObject({
            title: 'New AI software launches for researchers',
            summary: 'Teams & labs begin testing a new tool.',
            source: 'Example News',
            sources: ['Example News'],
            category: 'tech',
            imageUrl: 'https://images.example/ai.jpg',
        });
        expect(article?.id).toHaveLength(20);
    });

    it('rejects missing headlines and non-http article or image URLs', () => {
        expect(normalizeArticle({ title: 'A valid title', url: 'javascript:alert(1)' }, 'Example')).toBeNull();
        expect(normalizeArticle({ title: '', url: 'https://news.example/story' }, 'Example')).toBeNull();
        expect(normalizeArticle({ title: 'A valid title', url: 'https://news.example/story', imageUrl: 'data:image/png;base64,abc' }, 'Example')?.imageUrl).toBeNull();
    });

    it('produces the same id when only tracking parameters change', () => {
        const original = normalizeArticle({ title: 'A stable headline', url: 'https://news.example/story?utm_source=feed' }, 'Example');
        const clean = normalizeArticle({ title: 'A stable headline', url: 'https://news.example/story' }, 'Example');
        expect(original?.id).toBe(clean?.id);
    });

    it('uses RSS category tags and story keywords in the supported categories', () => {
        expect(normalizeArticle({ title: 'A new report', url: 'https://news.example/story', category: 'business' }, 'Example')?.category).toBe('business');
        expect(normalizeArticle({ title: 'Nauka otkriva novu planetu', url: 'https://news.example/story' }, 'Example')?.category).toBe('science');
        expect(normalizeArticle({ title: 'A new studio opens', url: 'https://news.example/technology/startup' }, 'Example')?.category).toBe('tech');
    });

    it('maps N1 section paths before keyword inference and uses source-aware fallbacks', () => {
        expect(normalizeArticle({ title: 'Local team wins', url: 'https://n1info.rs/sport/vest' }, 'N1 Serbia')?.category).toBe('sports');
        expect(normalizeArticle({ title: 'A new film premieres', url: 'https://n1info.rs/scena/vest' }, 'N1 Serbia')?.category).toBe('serbia');
        expect(normalizeArticle({ title: 'A local report', url: 'https://n1info.rs/vesti/vest' }, 'N1 Serbia')?.category).toBe('serbia');
        expect(normalizeArticle({ title: 'A local report', url: 'https://news.example/story' }, 'Example')?.category).toBe('general');
    });
});
