import { deduplicateArticles } from '../aggregation/deduplicate.js';
import { rankArticles, withinLast24Hours } from '../aggregation/rank.js';
import { Article } from '../types/article.js';
import { NewsProvider } from '../providers/news-provider.js';

export interface SourceStatus { name: string; ok: boolean; count: number; error?: string; }
export interface FeedResult { articles: Article[]; updatedAt: string; sourceStatus: SourceStatus[]; }

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export class NewsFeedService {
    private cached: { result: FeedResult; expiresAt: number } | null = null;
    private pending: Promise<FeedResult> | null = null;

    constructor(
        private readonly providers: NewsProvider[],
        private readonly ttlMs = 10 * 60 * 1000,
        private readonly now: () => number = Date.now,
    ) { }

    getNews(force = false): Promise<FeedResult> {
        if (!force && this.cached && this.cached.expiresAt > this.now()) return Promise.resolve(this.cached.result);
        if (this.pending) return this.pending;
        this.pending = this.fetchNews().then((result) => {
            this.cached = { result, expiresAt: this.now() + this.ttlMs };
            return result;
        }).finally(() => { this.pending = null; });
        return this.pending;
    }

    private async fetchNews(): Promise<FeedResult> {
        const results = await Promise.allSettled(this.providers.map((provider) => provider.fetchArticles()));
        const sourceStatus: SourceStatus[] = results.map((result, index) => ({
            name: this.providers[index]?.name ?? 'Unknown source',
            ok: result.status === 'fulfilled',
            count: result.status === 'fulfilled' ? result.value.length : 0,
            ...(result.status === 'rejected' ? { error: errorMessage(result.reason) } : {}),
        }));
        const articles = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
        const today = withinLast24Hours(articles, this.now());
        return { articles: rankArticles(deduplicateArticles(today), this.now()), updatedAt: new Date(this.now()).toISOString(), sourceStatus };
    }
}
