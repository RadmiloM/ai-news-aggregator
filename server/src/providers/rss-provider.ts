import Parser from 'rss-parser';
import { normalizeArticle } from '../aggregation/normalize-article.js';
import { Article } from '../types/article.js';
import { NewsProvider } from './news-provider.js';

export class RssProvider implements NewsProvider {
    readonly name: string;
    private readonly parser = new Parser();

    constructor(name: string, private readonly feedUrl: string) {
        this.name = name;
        const parsed = new URL(feedUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`Unsupported RSS protocol for ${name}`);
    }

    async fetchArticles(): Promise<Article[]> {
        const response = await fetch(this.feedUrl, { signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'DailyBrief/1.0 (+RSS news reader)' } });
        if (!response.ok) throw new Error(`${this.name} RSS returned ${response.status}`);
        const xml = await response.text();
        const feed = await this.parser.parseString(xml);
        return feed.items.flatMap((item) => {
            const raw = item as typeof item & Record<string, unknown>;
            const mediaContent = raw['media:content'] as { $?: { url?: string } } | undefined;
            const mediaThumbnail = raw['media:thumbnail'] as { $?: { url?: string } } | undefined;
            const enclosure = item.enclosure?.url;
            const imageUrl = enclosure || mediaContent?.$?.url || mediaThumbnail?.$?.url || null;
            const article = normalizeArticle({
                title: item.title,
                summary: item.contentSnippet || item.content || item.summary || item['description'],
                url: item.link,
                imageUrl,
                publishedAt: item.isoDate || item.pubDate,
                category: item.categories?.join(' '),
            }, this.name);
            return article ? [article] : [];
        });
    }
}
