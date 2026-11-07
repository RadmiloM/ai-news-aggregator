export type NewsCategory = 'world' | 'tech' | 'business' | 'sports' | 'science' | 'health' | 'culture' | 'other';

export interface Article {
    id: string;
    title: string;
    summary: string;
    source: string;
    sources: string[];
    url: string;
    imageUrl: string | null;
    publishedAt: string;
    category: NewsCategory;
    importance?: number;
}
