import { normalizeArticle } from '../aggregation/normalize-article.js';
import { Article } from '../types/article.js';
import { NewsProvider } from './news-provider.js';

type JsonRecord = Record<string, unknown>;

async function getJson(url: URL): Promise<JsonRecord> {
    const response = await fetch(url, { signal: AbortSignal.timeout(9_000), headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`News API returned ${response.status}`);
    return await response.json() as JsonRecord;
}

export class NewsApiProvider implements NewsProvider {
    readonly name = 'NewsAPI';
    constructor(private readonly apiKey: string) { }

    async fetchArticles(): Promise<Article[]> {
        const url = new URL('https://newsapi.org/v2/top-headlines');
        url.searchParams.set('country', 'us');
        url.searchParams.set('category', 'general');
        url.searchParams.set('pageSize', '100');
        const response = await fetch(url, { signal: AbortSignal.timeout(9_000), headers: { 'X-Api-Key': this.apiKey, accept: 'application/json' } });
        if (!response.ok) throw new Error(`NewsAPI returned ${response.status}`);
        const data = await response.json() as JsonRecord;
        const items = Array.isArray(data['articles']) ? data['articles'] as JsonRecord[] : [];
        return items.flatMap((item) => {
            const source = item['source'] as JsonRecord | undefined;
            const article = normalizeArticle({
                title: item['title'], summary: item['description'], url: item['url'], imageUrl: item['urlToImage'], publishedAt: item['publishedAt'],
            }, typeof source?.['name'] === 'string' ? source['name'] : 'NewsAPI');
            return article ? [article] : [];
        });
    }
}

export class GNewsProvider implements NewsProvider {
    readonly name = 'GNews';
    constructor(private readonly apiKey: string) { }

    async fetchArticles(): Promise<Article[]> {
        const url = new URL('https://gnews.io/api/v4/top-headlines');
        url.searchParams.set('token', this.apiKey);
        url.searchParams.set('lang', 'en');
        url.searchParams.set('max', '100');
        const data = await getJson(url);
        const items = Array.isArray(data['articles']) ? data['articles'] as JsonRecord[] : [];
        return items.flatMap((item) => {
            const source = item['source'] as JsonRecord | undefined;
            const article = normalizeArticle({
                title: item['title'], summary: item['description'], url: item['url'], imageUrl: item['image'], publishedAt: item['publishedAt'],
            }, typeof source?.['name'] === 'string' ? source['name'] : 'GNews');
            return article ? [article] : [];
        });
    }
}
