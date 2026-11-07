import { Request, Response, Router } from 'express';
import { NewsCategory } from '../types/article.js';
import { NewsFeedService } from '../services/news-feed-service.js';
import { SummaryService } from '../services/summary-service.js';

const validCategories = new Set<NewsCategory>(['world', 'tech', 'business', 'sports', 'science', 'health', 'culture', 'other']);

export function createApiRouter(news: NewsFeedService, summaries: SummaryService): Router {
    const router = Router();
    router.get('/health', (_request, response) => response.json({ status: 'ok' }));

    router.get('/news', async (request: Request, response: Response) => {
        try {
            const feed = await news.getNews();
            const category = typeof request.query['category'] === 'string' ? request.query['category'] : '';
            const source = typeof request.query['source'] === 'string' ? request.query['source'] : '';
            const query = typeof request.query['q'] === 'string' ? request.query['q'].trim().toLowerCase() : '';
            const articles = feed.articles.filter((article) => {
                const matchesCategory = !category || category === 'all' || (validCategories.has(category as NewsCategory) && article.category === category);
                const matchesSource = !source || source === 'all' || article.sources.includes(source);
                const matchesQuery = !query || `${article.title} ${article.summary} ${article.sources.join(' ')}`.toLowerCase().includes(query);
                return matchesCategory && matchesSource && matchesQuery;
            });
            response.json({ ...feed, articles });
        } catch (error) {
            console.error('News aggregation failed:', error);
            response.status(503).json({ error: 'News sources are temporarily unavailable.' });
        }
    });

    router.post('/summarize', async (request: Request, response: Response) => {
        const body = request.body as Record<string, unknown>;
        const id = typeof body['id'] === 'string' ? body['id'].slice(0, 120) : '';
        const title = typeof body['title'] === 'string' ? body['title'].trim().slice(0, 400) : '';
        const summary = typeof body['summary'] === 'string' ? body['summary'].slice(0, 2000) : '';
        const source = typeof body['source'] === 'string' ? body['source'].slice(0, 120) : 'Publisher';
        const url = typeof body['url'] === 'string' && body['url'].length <= 2048 ? body['url'] : undefined;
        if (!id || title.length < 3) {
            response.status(400).json({ error: 'A story id and title are required.' });
            return;
        }
        if (url) {
            try {
                const parsed = new URL(url);
                if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported URL protocol');
            } catch {
                response.status(400).json({ error: 'The story URL is invalid.' });
                return;
            }
        }
        const result = await summaries.summarize({ id, title, summary, source, url }, request.ip || 'unknown');
        response.json(result);
    });

    return router;
}
