import Parser from 'rss-parser';
import { normalizeArticle } from '../aggregation/normalize-article.js';
import { Article } from '../types/article.js';
import { NewsProvider } from './news-provider.js';

function mediaUrl(value: unknown): string | null {
    const mediaItems = Array.isArray(value) ? value : [value];
    const candidates = mediaItems.flatMap((media, index) => {
        if (!media || typeof media !== 'object') return [];
        const fields = media as { $?: { url?: unknown; width?: unknown }; url?: unknown; width?: unknown };
        const url = fields.$?.url ?? fields.url;
        if (typeof url !== 'string' || !url.trim()) return [];
        const rawWidth = fields.$?.width ?? fields.width;
        const parsedWidth = typeof rawWidth === 'number' ? rawWidth : Number(rawWidth);
        return [{ url, width: Number.isFinite(parsedWidth) && parsedWidth >= 0 ? parsedWidth : -1, index }];
    });
    candidates.sort((left, right) => right.width - left.width || left.index - right.index);
    return candidates[0]?.url ?? null;
}

function resolveImageUrl(value: string, articleUrl: string): string | null {
    try {
        const url = new URL(value, articleUrl);
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
    } catch {
        return null;
    }
}

function categoryLabels(value: unknown): string {
    if (!Array.isArray(value)) return '';
    return value.flatMap((category) => {
        if (typeof category === 'string') return [category];
        if (!category || typeof category !== 'object') return [];
        const label = (category as { _?: unknown })._;
        return typeof label === 'string' ? [label] : [];
    }).join(' ');
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
        const xml = await this.fetchFeedXml();
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
                category: categoryLabels(item.categories),
            }, this.name);
            return article ? [article] : [];
        });
    }

    private async fetchFeedXml(): Promise<string> {
        let lastError: unknown;
        for (let attempt = 1; attempt <= 2; attempt++) {
            let response: Response | undefined;
            try {
                response = await fetch(this.feedUrl, {
                    signal: AbortSignal.timeout(10_000),
                    headers: {
                        'user-agent': 'Mozilla/5.0 NewsAggregator/1.0',
                        accept: 'application/rss+xml',
                    },
                });
                if (!response.ok) {
                    const body = (await response.text().catch(() => '')).trim().slice(0, 500);
                    const message = `${this.name} RSS returned HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}${body ? `: ${body}` : ''}`;
                    const error = new Error(message);
                    console.error('RSS feed request failed', {
                        source: this.name,
                        url: this.feedUrl,
                        attempt,
                        status: response.status,
                        error: error.message,
                        headers: Object.fromEntries(response.headers.entries()),
                    });
                    lastError = error;
                    continue;
                }
                return await response.text();
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error('RSS feed request failed', {
                    source: this.name,
                    url: this.feedUrl,
                    attempt,
                    status: response?.status ?? null,
                    error: message,
                    headers: response ? Object.fromEntries(response.headers.entries()) : null,
                });
                lastError = error;
            }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
}
