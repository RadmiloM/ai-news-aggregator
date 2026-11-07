import { config } from '../config.js';
import { NewsApiProvider, GNewsProvider } from './api-providers.js';
import { NewsProvider } from './news-provider.js';
import { RssProvider } from './rss-provider.js';

export function createProviders(): NewsProvider[] {
    const providers: NewsProvider[] = config.feeds.map((feed) => new RssProvider(feed.name, feed.url));
    if (config.newsApiKey) providers.push(new NewsApiProvider(config.newsApiKey));
    if (config.gnewsApiKey) providers.push(new GNewsProvider(config.gnewsApiKey));
    return providers;
}
