import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Article, NewsFeedResponse, SummaryResponse } from '../models/article.model';

@Injectable({ providedIn: 'root' })
export class NewsApiService {
    private readonly http = inject(HttpClient);

    getNews(): Observable<NewsFeedResponse> {
        return this.http.get<NewsFeedResponse>('/api/news');
    }

    summarize(article: Article): Observable<SummaryResponse> {
        return this.http.post<SummaryResponse>('/api/summarize', {
            id: article.id,
            title: article.title,
            summary: article.summary,
            source: article.source,
            url: article.url,
        });
    }
}
