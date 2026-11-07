import { Article } from '../types/article.js';
import { normalizeTitle, titleSimilarity } from './title-similarity.js';

interface StoryGroup { anchor: Article; items: Article[]; }

function canonicalUrl(value: string): string {
    try {
        const url = new URL(value);
        url.hash = '';
        url.search = '';
        return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`.toLowerCase();
    } catch {
        return value.trim().toLowerCase();
    }
}

export function deduplicateArticles(articles: Article[], threshold = 0.58): Article[] {
    const sorted = [...articles].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    const groups: StoryGroup[] = [];

    for (const article of sorted) {
        const group = groups.find((candidate) => {
            if (canonicalUrl(candidate.anchor.url) === canonicalUrl(article.url)) return true;
            const similarity = titleSimilarity(candidate.anchor.title, article.title);
            const sharedPublisher = (candidate.anchor.sources ?? [candidate.anchor.source]).includes(article.source);
            return similarity >= (sharedPublisher ? Math.max(threshold, 0.78) : threshold);
        });
        if (group) group.items.push(article);
        else groups.push({ anchor: article, items: [article] });
    }

    return groups.map(({ anchor, items }) => {
        const sources = [...new Set(items.flatMap((item) => item.sources?.length ? item.sources : [item.source]))].sort();
        const bestSummary = [...items].sort((a, b) => b.summary.length - a.summary.length)[0]?.summary ?? anchor.summary;
        const imageUrl = items.find((item) => item.imageUrl)?.imageUrl ?? null;
        const category = items.find((item) => item.category !== 'general')?.category ?? anchor.category;
        return { ...anchor, summary: bestSummary, imageUrl, category, sources };
    });
}

export function normalizedHeadline(title: string): string {
    return normalizeTitle(title);
}
