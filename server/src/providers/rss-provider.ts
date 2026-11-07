import Parser from 'rss-parser';
import { normalizeArticle } from '../aggregation/normalize-article.js';
import { Article } from '../types/article.js';
import { NewsProvider } from './news-provider.js';

function firstValue(value: unknown): unknown {
    return Array.isArray(value) ? value[0] : value;
}

function mediaUrl(value: unknown): string | null {
    const media = firstValue(value);
    if (!media || typeof media !== 'object') return null;
    const fields = media as { $?: { url?: unknown }; url?: unknown };
    const url = fields.$?.url ?? fields.url;
    return typeof url === 'string' && url.trim() ? url : null;
}

function resolveImageUrl(value: string, articleUrl: string): string | null {
    try {
        const url = new URL(value, articleUrl);
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
    } catch {
        return null;
    }
}

function firstImageInHtml(value: unknown, articleUrl: string): string | null {
    if (typeof value !== 'string') return null;
    const source = value.match(/<img\b[^>]*(?:^|\s)src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    const imageUrl = source?.[1] ?? source?.[2] ?? source?.[3];
    if (!imageUrl) return null;
    return resolveImageUrl(imageUrl.replace(/&amp;/gi, '&'), articleUrl);
}

function itemImageUrl(item: Record<string, unknown>, articleUrl: string): string | null {
    const mediaContentUrl = mediaUrl(item['media:content']);
    const mediaContentImage = mediaContentUrl ? resolveImageUrl(mediaContentUrl, articleUrl) : null;
    if (mediaContentImage) return mediaContentImage;

    const mediaThumbnailUrl = mediaUrl(item['media:thumbnail']);
    const mediaThumbnailImage = mediaThumbnailUrl ? resolveImageUrl(mediaThumbnailUrl, articleUrl) : null;
    if (mediaThumbnailImage) return mediaThumbnailImage;

    const enclosure = item['enclosure'];
    if (enclosure && typeof enclosure === 'object') {
        const fields = enclosure as { url?: unknown; type?: unknown };
        if (typeof fields.url === 'string' && typeof fields.type === 'string' && fields.type.toLowerCase().startsWith('image/')) {
            const enclosureImage = resolveImageUrl(fields.url, articleUrl);
            if (enclosureImage) return enclosureImage;
        }
    }

    return firstImageInHtml(item['content:encoded'], articleUrl)
        ?? firstImageInHtml(item['content'], articleUrl)
        ?? firstImageInHtml(item['description'], articleUrl);
}

export class RssProvider implements NewsProvider {
    readonly name: string;
    private readonly parser = new Parser({
        customFields: {
            item: [
                ['media:content', 'media:content', { keepArray: true }],
                ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
            ],
        },
    });

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
            const articleUrl = item.link;
            const imageUrl = articleUrl ? itemImageUrl(raw, articleUrl) : null;
            const article = normalizeArticle({
                title: item.title,
                summary: item.contentSnippet || item.content || item.summary || raw['description'],
                url: articleUrl,
                imageUrl,
                publishedAt: item.isoDate || item.pubDate,
                category: item.categories?.join(' '),
            }, this.name);
            return article ? [article] : [];
        });
    }
}
