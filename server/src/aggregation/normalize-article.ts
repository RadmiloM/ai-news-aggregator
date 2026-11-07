import { createHash } from 'node:crypto';
import { inferCategory } from './category.js';
import { Article } from '../types/article.js';

export interface ArticleInput {
    title?: unknown;
    summary?: unknown;
    url?: unknown;
    imageUrl?: unknown;
    publishedAt?: unknown;
    category?: unknown;
}

function cleanText(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function safeHttpUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
    } catch {
        return null;
    }
}

function articleId(url: string, title: string): string {
    const canonical = new URL(url);
    canonical.hash = '';
    canonical.search = '';
    return createHash('sha256').update(`${canonical.hostname.toLowerCase()}${canonical.pathname.toLowerCase()}|${title.toLowerCase()}`).digest('hex').slice(0, 20);
}

export function normalizeArticle(input: ArticleInput, source: string): Article | null {
    const title = cleanText(input.title).slice(0, 400);
    const url = safeHttpUrl(input.url);
    if (!title || !url) return null;
    const summary = cleanText(input.summary).slice(0, 2000);
    const publishedAtValue = typeof input.publishedAt === 'string' || typeof input.publishedAt === 'number' ? new Date(input.publishedAt) : new Date();
    const publishedAt = Number.isFinite(publishedAtValue.getTime()) ? publishedAtValue.toISOString() : new Date().toISOString();
    const categoryHint = typeof input.category === 'string' ? input.category : '';
    const category = inferCategory(title, summary, categoryHint, url, source);
    return {
        id: articleId(url, title), title, summary, source, sources: [source], url,
        imageUrl: safeHttpUrl(input.imageUrl), publishedAt, category,
    };
}
