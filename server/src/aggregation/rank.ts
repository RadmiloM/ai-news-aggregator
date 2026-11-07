import { Article } from '../types/article.js';

export function importanceScore(article: Article, now = Date.now()): number {
    const ageHours = Math.max(0, (now - Date.parse(article.publishedAt)) / 3_600_000);
    const recency = 0.7 * Math.exp(-ageHours / 24);
    const coverage = 0.3 * Math.min(1, Math.log2(Math.max(1, article.sources?.length ?? 1)) / Math.log2(5));
    return recency + coverage;
}

export function rankArticles(articles: Article[], now = Date.now()): Article[] {
    return articles
        .map((article) => ({ ...article, importance: importanceScore(article, now) }))
        .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0)
            || Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
            || a.title.localeCompare(b.title));
}

export function withinLast24Hours(articles: Article[], now = Date.now()): Article[] {
    const cutoff = now - 24 * 60 * 60 * 1000;
    return articles.filter((article) => {
        const publishedAt = Date.parse(article.publishedAt);
        return Number.isFinite(publishedAt) && publishedAt >= cutoff && publishedAt <= now;
    });
}
