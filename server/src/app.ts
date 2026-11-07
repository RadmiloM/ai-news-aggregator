import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { createApiRouter } from './routes/api.js';
import { NewsFeedService } from './services/news-feed-service.js';
import { SummaryService } from './services/summary-service.js';
import { ArticleImageService } from './services/article-image-service.js';
import { createProviders } from './providers/index.js';

export function createApp(): express.Express {
    const app = express();
    const allowedOrigins = (process.env['CORS_ORIGIN'] || 'http://localhost:4200,http://127.0.0.1:4200').split(',').map((origin) => origin.trim());
    app.disable('x-powered-by');
    app.use(helmet());
    app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)) }));
    app.use(express.json({ limit: '20kb' }));

    const feed = new NewsFeedService(createProviders(), config.newsCacheTtlMs);
    const images = new ArticleImageService();
    const summaries = new SummaryService({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        requestsPerMinute: config.geminiRequestsPerMinute,
        requestsPerDay: config.geminiRequestsPerDay,
        perIpPerMinute: config.geminiPerIpPerMinute,
        concurrency: config.geminiConcurrency,
        queueLimit: config.geminiQueueLimit,
    });
    app.use('/api', createApiRouter(feed, summaries, images));
    app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
        console.error('Request failed:', error);
        response.status(400).json({ error: 'The request could not be processed.' });
    });
    return app;
}
