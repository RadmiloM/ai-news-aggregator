export type NewsCategory = 'world' | 'tech' | 'business' | 'sports' | 'science' | 'serbia' | 'general';

export interface Article {
    id: string;
    title: string;
    summary: string;
    source: string;
    sources?: string[];
    url: string;
    imageUrl: string | null;
    publishedAt: string;
    category: NewsCategory;
    aiSummary?: string;
    importance?: number;
}

export interface NewsFeedResponse {
    articles: Article[];
    updatedAt: string;
    sourceStatus: { name: string; ok: boolean; count: number; error?: string }[];
}

export interface SummaryResponse {
    summary: string;
    generated: boolean;
}
