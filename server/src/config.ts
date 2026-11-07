import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const envPath = existsSync(resolve(process.cwd(), '.env')) ? resolve(process.cwd(), '.env') : resolve(process.cwd(), '../.env');
dotenv.config({ path: envPath });

function positiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
    port: positiveInt(process.env['PORT'], 3001),
    newsCacheTtlMs: positiveInt(process.env['NEWS_CACHE_TTL_MS'], 10 * 60 * 1000),
    newsApiKey: process.env['NEWS_API_KEY']?.trim() ?? '',
    gnewsApiKey: process.env['GNEWS_API_KEY']?.trim() ?? '',
    geminiApiKey: process.env['GEMINI_API_KEY']?.trim() ?? '',
    geminiModel: process.env['GEMINI_MODEL']?.trim() || 'gemini-2.5-flash',
    geminiRequestsPerMinute: positiveInt(process.env['GEMINI_REQUESTS_PER_MINUTE'], 10),
    geminiRequestsPerDay: positiveInt(process.env['GEMINI_REQUESTS_PER_DAY'], 100),
    geminiPerIpPerMinute: positiveInt(process.env['GEMINI_PER_IP_PER_MINUTE'], 5),
    geminiConcurrency: positiveInt(process.env['GEMINI_CONCURRENCY'], 2),
    geminiQueueLimit: positiveInt(process.env['GEMINI_QUEUE_LIMIT'], 20),
    feeds: [
        { name: 'BBC', url: process.env['RSS_BBC_URL'] || 'https://feeds.bbci.co.uk/news/world/rss.xml' },
        { name: 'Guardian World', url: process.env['RSS_GUARDIAN_URL'] || 'https://www.theguardian.com/world/rss' },
        { name: 'Al Jazeera', url: process.env['RSS_ALJAZEERA_URL'] || 'https://www.aljazeera.com/xml/rss/all.xml' },
        { name: 'N1 Serbia', url: process.env['RSS_N1_URL'] || 'https://n1info.rs/feed/' },
        { name: 'Danas', url: process.env['RSS_DANAS_URL'] || 'https://www.danas.rs/feed/' },
    ],
};
