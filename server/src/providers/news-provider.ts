import { Article } from '../types/article.js';

export interface NewsProvider {
    readonly name: string;
    fetchArticles(): Promise<Article[]>;
}
