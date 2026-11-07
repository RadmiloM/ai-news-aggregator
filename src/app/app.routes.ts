import { Routes } from '@angular/router';
import { NewsFeedPage } from './features/news-feed/news-feed-page';

export const routes: Routes = [{ path: '', component: NewsFeedPage }, { path: '**', redirectTo: '' }];
