import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Article, NewsFeedResponse } from '../models/article.model';
import { NewsApiService } from './news-api.service';

@Injectable({ providedIn: 'root' })
export class NewsFeedStore {
    private readonly api = inject(NewsApiService);
    readonly articles = signal<Article[]>([]);
    readonly sourceStatus = signal<NewsFeedResponse['sourceStatus']>([]);
    readonly loading = signal(true);
    readonly refreshing = signal(false);
    readonly error = signal<string | null>(null);
    readonly updatedAt = signal<string | null>(null);
    readonly sources = computed(() => [...new Set(this.articles().flatMap((article) => article.sources ?? [article.source]))].sort());

    async refresh(): Promise<void> {
        if (this.refreshing()) return;
        this.refreshing.set(true);
        this.error.set(null);
        try {
            const response = await firstValueFrom(this.api.getNews());
            this.articles.set(response.articles);
            this.sourceStatus.set(response.sourceStatus ?? []);
            this.updatedAt.set(response.updatedAt);
        } catch {
            this.error.set('The newsroom could not be reached. Check the server and try again.');
        } finally {
            this.loading.set(false);
            this.refreshing.set(false);
        }
    }

    async summarize(article: Article): Promise<void> {
        try {
            const result = await firstValueFrom(this.api.summarize(article));
            if (!result.generated) return;
            this.articles.update((articles) => articles.map((item) => item.id === article.id ? { ...item, aiSummary: result.summary } : item));
        } catch {
            // The publisher description remains visible when summary generation is unavailable.
        }
    }
}
