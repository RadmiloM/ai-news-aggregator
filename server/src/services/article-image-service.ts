import { isIP } from 'node:net';

const cacheTtlMs = 24 * 60 * 60 * 1000;
const requestTimeoutMs = 3_000;
const maxConcurrentRequests = 5;
const maxHtmlBytes = 1_000_000;
const maxRedirects = 3;

interface QueueItem {
    url: string;
    resolve: (imageUrl: string | null) => void;
    reject: (error: unknown) => void;
}

function decodeHtml(value: string): string {
    return value.replace(/&(?:amp|quot|apos|lt|gt|#39|#x27);/gi, (entity) => {
        const entities: Record<string, string> = {
            '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&#39;': "'", '&#x27;': "'",
        };
        return entities[entity.toLowerCase()] ?? entity;
    });
}

function isPrivateIp(hostname: string): boolean {
    const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const ipVersion = isIP(host);
    if (ipVersion === 4) {
        const [first, second] = host.split('.').map(Number);
        return first === 0 || first === 10 || first === 127
            || (first === 169 && second === 254)
            || (first === 172 && second !== undefined && second >= 16 && second <= 31)
            || (first === 192 && second === 168)
            || (first === 100 && second !== undefined && second >= 64 && second <= 127)
            || (first === 198 && second !== undefined && (second === 18 || second === 19))
            || first >= 224;
    }
    if (ipVersion === 6) {
        return host === '::' || host === '::1' || host.startsWith('::ffff:')
            || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith('ff');
    }
    return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local');
}

function safeHttpUrl(value: string, base?: string): string | null {
    try {
        const parsed = base ? new URL(value, base) : new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || isPrivateIp(parsed.hostname)) return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

export function extractOgImage(html: string, pageUrl: string): string | null {
    const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
    for (const tag of metaTags) {
        const attributes = new Map<string, string>();
        const attributePattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
        for (const match of tag.matchAll(attributePattern)) {
            attributes.set((match[1] ?? '').toLowerCase(), decodeHtml(match[2] ?? match[3] ?? match[4] ?? ''));
        }
        if (attributes.get('property')?.toLowerCase() !== 'og:image') continue;
        const content = attributes.get('content');
        if (content) return safeHttpUrl(content, pageUrl);
    }
    return null;
}

async function readHtml(response: Response): Promise<string> {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maxHtmlBytes) {
        throw new Error('Article page exceeds the image lookup size limit.');
    }
    if (!response.body) return '';

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        totalBytes += value.byteLength;
        if (totalBytes > maxHtmlBytes) {
            await reader.cancel();
            throw new Error('Article page exceeds the image lookup size limit.');
        }
        chunks.push(value);
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(body);
}

export class ArticleImageService {
    private readonly cache = new Map<string, { imageUrl: string | null; expiresAt: number }>();
    private readonly pending = new Map<string, Promise<string | null>>();
    private readonly queue: QueueItem[] = [];
    private activeRequests = 0;

    constructor(private readonly fetchPage: typeof fetch = fetch, private readonly now: () => number = Date.now) { }

    getImage(articleUrl: string): Promise<string | null> {
        const safeUrl = safeHttpUrl(articleUrl);
        if (!safeUrl) return Promise.reject(new Error('The article URL is not safe to fetch.'));

        const cached = this.cache.get(safeUrl);
        if (cached && cached.expiresAt > this.now()) return Promise.resolve(cached.imageUrl);
        if (cached) this.cache.delete(safeUrl);

        const existing = this.pending.get(safeUrl);
        if (existing) return existing;

        const lookup = new Promise<string | null>((resolve, reject) => {
            this.queue.push({ url: safeUrl, resolve, reject });
        });
        this.pending.set(safeUrl, lookup);
        this.drainQueue();
        return lookup;
    }

    private drainQueue(): void {
        while (this.activeRequests < maxConcurrentRequests && this.queue.length) {
            const item = this.queue.shift();
            if (!item) continue;
            this.activeRequests += 1;
            void this.fetchOgImage(item.url).then((imageUrl) => {
                this.cache.set(item.url, { imageUrl, expiresAt: this.now() + cacheTtlMs });
                this.pending.delete(item.url);
                item.resolve(imageUrl);
            }).catch((error: unknown) => {
                this.pending.delete(item.url);
                item.reject(error);
            }).finally(() => {
                this.activeRequests -= 1;
                this.drainQueue();
            });
        }
    }

    private async fetchOgImage(articleUrl: string): Promise<string | null> {
        const signal = AbortSignal.timeout(requestTimeoutMs);
        let currentUrl = articleUrl;

        for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
            const response = await this.fetchPage(currentUrl, {
                signal,
                redirect: 'manual',
                headers: {
                    accept: 'text/html,application/xhtml+xml',
                    'user-agent': 'DailyBrief/1.0 (+RSS news reader)',
                },
            });

            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get('location');
                if (!location || redirectCount === maxRedirects) return null;
                const redirectUrl = safeHttpUrl(location, currentUrl);
                if (!redirectUrl) return null;
                currentUrl = redirectUrl;
                continue;
            }
            if (!response.ok) return null;

            const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
            if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) return null;
            return extractOgImage(await readHtml(response), currentUrl);
        }
        return null;
    }
}
