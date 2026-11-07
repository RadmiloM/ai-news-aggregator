import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Article, NewsCategory } from '../../core/models/article.model';
import { NewsFeedStore } from '../../core/services/news-feed.store';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';
import { NewsCard } from './news-card';

const categories: { id: NewsCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'Top stories' },
    { id: 'world', label: 'World' },
    { id: 'tech', label: 'Technology' },
    { id: 'business', label: 'Business' },
    { id: 'sports', label: 'Sport' },
    { id: 'science', label: 'Science' },
    { id: 'serbia', label: 'Serbia' },
    { id: 'general', label: 'General' },
];

@Component({
    selector: 'app-news-feed-page',
    standalone: true,
    imports: [DatePipe, FormsModule, NewsCard, ThemeToggle],
    template: `
    <div class="page-shell">
      <header class="masthead">
        <a class="brand" href="/" aria-label="The Daily Brief home"><span class="brand-mark">DB</span><span class="brand-name">The Daily Brief</span></a>
        <div class="edition"><span class="live-dot"></span> {{ editionLabel() }} <span class="edition-rule"></span><span class="edition-date">{{ today }}</span></div>
        <div class="header-actions"><span class="auto-status"><span class="live-dot"></span> Updates every 10 min</span><app-theme-toggle /></div>
      </header>
      <main>
        <section class="intro" aria-labelledby="page-title">
          <div class="intro-copy"><p class="eyebrow">A clearer view of what matters</p><h1 id="page-title">The world,<br /><em>in focus.</em></h1><p class="intro-deck">Today’s leading stories, gathered from independent newsrooms around the world.</p></div>
          <div class="edition-stamp"><span>MONDAY—SUNDAY</span><strong>24</strong><span>HOUR EDITION</span><i></i></div>
          <div class="intro-note"><span class="note-line"></span><span>INDEPENDENT SOURCES<br />ONE DAILY BRIEFING</span></div>
        </section>
        <section class="feed-section" aria-labelledby="feed-heading">
          <div class="section-heading"><div><p class="eyebrow">The latest</p><h2 id="feed-heading">Today’s briefing</h2></div>
            <div class="feed-status">@if (store.updatedAt()) { <span>Updated {{ store.updatedAt() | date: 'shortTime' }}</span> }<button class="refresh-button" type="button" (click)="refresh()" [disabled]="store.refreshing()" aria-label="Refresh headlines"><span [class.spinning]="store.refreshing()" aria-hidden="true">↻</span> {{ store.refreshing() ? 'Refreshing' : 'Refresh' }}</button></div>
          </div>
          <nav class="category-nav" aria-label="Filter by category">
            @for (category of visibleCategories(); track category.id) { <button type="button" [class.active]="selectedCategory() === category.id" (click)="selectedCategory.set(category.id)">{{ category.label }}</button> }
          </nav>
          <div class="filters">
            <label class="search-field"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search today’s stories" [ngModel]="query()" (ngModelChange)="query.set($event)" aria-label="Search headlines" /></label>
            <label class="source-filter"><span>Source</span><select [ngModel]="selectedSource()" (ngModelChange)="selectedSource.set($event)" aria-label="Filter by news source"><option value="all">All sources</option>@for (source of store.sources(); track source) { <option [value]="source">{{ source }}</option> }</select></label>
            <span class="result-count">{{ filteredArticles().length }} STORIES</span>
          </div>
          @if (unavailableSources()) {
            <details class="partial-warning" role="status">
              <summary>Unavailable sources: {{ unavailableSources() }}. @if (store.articles().length) { Showing available stories. } @else { No stories are available from the remaining sources. }</summary>
              <ul>@for (source of unavailableSourceStatuses(); track source.name) { <li><strong>{{ source.name }}:</strong> {{ source.error || 'No error details were provided.' }}</li> }</ul>
            </details>
          }
          @if (store.loading()) {
            <div class="story-grid" aria-label="Loading headlines" aria-busy="true">@for (item of [1, 2, 3, 4, 5]; track item) { <div class="skeleton"><div class="skeleton-image"></div><div class="skeleton-lines"><i></i><i></i><i></i></div></div> }</div>
          } @else if (store.error() && !store.articles().length) {
            <div class="state-panel error-state"><span class="state-mark">!</span><div><h3>We’ve lost the signal.</h3><p>{{ store.error() }}</p><button class="refresh-button" type="button" (click)="refresh()">Try again</button></div></div>
          } @else if (!filteredArticles().length) {
            <div class="state-panel"><span class="state-mark">—</span><div><h3>No stories in this edition.</h3><p>Try another topic or clear your search.</p><button class="text-button" type="button" (click)="clearFilters()">Clear filters</button></div></div>
          } @else {
            <div class="story-grid">@for (article of filteredArticles(); track article.id; let first = $first) { <app-news-card [article]="article" [featured]="first" /> }</div>
          }
          @if (store.sourceStatus().length) { <footer class="source-credits"><span>REPORTING FROM</span>@for (source of store.sourceStatus(); track source.name) { @if (source.ok) { <span class="credit-name">{{ source.name }}</span> } }</footer> }
        </section>
      </main>
      <footer class="page-footer"><span>THE DAILY BRIEF</span><span>Stories belong to their original publishers.</span><span>Built for a more informed day.</span></footer>
    </div>
  `,
    styles: [`
    :host { display: block; }
    .page-shell { width: min(1440px, 100%); margin: 0 auto; padding: 0 clamp(20px, 5vw, 76px); }
    .masthead { display: flex; align-items: center; justify-content: space-between; min-height: 69px; border-bottom: 1px solid var(--line); gap: 18px; }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; }
    .brand-mark { display: grid; place-items: center; width: 31px; height: 31px; background: var(--accent); color: #fff; font-family: 'Newsreader', Georgia, serif; font-size: 14px; font-weight: 600; }
    .brand-name { font-family: 'Newsreader', Georgia, serif; font-size: 18px; font-weight: 600; }
    .edition { display: flex; align-items: center; gap: 9px; color: var(--muted); font-size: 9px; font-weight: 700; letter-spacing: .12em; }
    .live-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #7d946d; box-shadow: 0 0 0 3px color-mix(in srgb, #7d946d 17%, transparent); }
    .edition-rule { height: 1px; width: 30px; background: var(--line); }
    .header-actions { display: flex; align-items: center; gap: 18px; }
    .auto-status { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 11px; }
    .intro { position: relative; display: grid; grid-template-columns: 1fr auto; align-items: end; min-height: 310px; padding: 45px 0 39px; border-bottom: 1px solid var(--line); overflow: hidden; }
    .intro::after { position: absolute; z-index: -1; right: 16%; bottom: -142px; width: 350px; height: 350px; content: ''; border: 1px solid var(--line); border-radius: 50%; box-shadow: 0 0 0 26px color-mix(in srgb, var(--line) 32%, transparent), 0 0 0 52px color-mix(in srgb, var(--line) 18%, transparent); }
    .intro-copy { position: relative; z-index: 1; }
    .eyebrow { margin: 0; color: var(--accent); font-size: 10px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
    .intro h1 { margin: 12px 0 15px; font-family: 'Newsreader', Georgia, serif; font-size: clamp(54px, 7vw, 88px); font-weight: 400; line-height: .87; }
    .intro h1 em { color: var(--accent); font-weight: 400; }
    .intro-deck { max-width: 390px; margin: 0; color: var(--muted); font-size: 14px; line-height: 1.6; }
    .edition-stamp { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 116px; height: 116px; margin: 0 54px 7px 0; border: 1px solid var(--line); border-radius: 50%; color: var(--muted); font-size: 7px; font-weight: 700; letter-spacing: .1em; transform: rotate(-9deg); }
    .edition-stamp strong { color: var(--accent); font-family: 'Newsreader', Georgia, serif; font-size: 42px; font-weight: 400; line-height: 1; }
    .edition-stamp i { position: absolute; right: 9px; top: 20px; width: 6px; height: 6px; border-radius: 50%; background: var(--olive); }
    .intro-note { position: absolute; right: 0; bottom: 39px; display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 8px; line-height: 1.55; letter-spacing: .1em; }
    .note-line { display: block; width: 27px; height: 1px; background: var(--accent); }
    .feed-section { padding: 37px 0 0; }
    .section-heading { display: flex; justify-content: space-between; align-items: end; gap: 20px; }
    .section-heading h2 { margin: 5px 0 0; font-family: 'Newsreader', Georgia, serif; font-size: 32px; font-weight: 500; }
    .feed-status { display: flex; align-items: center; gap: 15px; color: var(--muted); font-size: 11px; }
    .refresh-button { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 12px; border: 1px solid var(--line); border-radius: 3px; background: var(--surface); color: var(--ink); font-size: 11px; font-weight: 600; cursor: pointer; }
    .refresh-button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
    .refresh-button:disabled { opacity: .65; cursor: wait; }
    .refresh-button span { color: var(--accent); font-size: 17px; }
    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .category-nav { display: flex; align-items: center; gap: clamp(18px, 3vw, 38px); margin-top: 25px; border-bottom: 1px solid var(--line); overflow-x: auto; }
    .category-nav button { position: relative; flex: 0 0 auto; min-height: 42px; padding: 0 0 11px; border: 0; background: transparent; color: var(--muted); font-size: 12px; cursor: pointer; }
    .category-nav button::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; content: ''; background: transparent; }
    .category-nav button.active { color: var(--ink); font-weight: 700; }
    .category-nav button.active::after { background: var(--accent); }
    .filters { display: flex; align-items: center; gap: 18px; min-height: 70px; border-bottom: 1px solid var(--line); }
    .search-field { display: flex; align-items: center; flex: 1; max-width: 360px; gap: 9px; color: var(--muted); }
    .search-field > span { color: var(--accent); font-size: 21px; line-height: 1; }
    .search-field input { width: 100%; min-width: 0; padding: 8px 0; border: 0; outline: 0; background: transparent; color: var(--ink); font-size: 12px; }
    .search-field input::placeholder { color: var(--muted); }
    .source-filter { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 11px; }
    .source-filter select { max-width: 180px; padding: 8px 26px 8px 9px; border: 1px solid var(--line); border-radius: 3px; background: var(--surface); color: var(--ink); font-size: 11px; }
    .result-count { margin-left: auto; color: var(--muted); font-size: 9px; font-weight: 700; letter-spacing: .11em; white-space: nowrap; }
    .story-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 17px; padding-top: 20px; }
    .story-grid app-news-card:first-child { grid-column: span 2; grid-row: span 2; }
    .skeleton { overflow: hidden; border: 1px solid var(--line); background: var(--surface-raised); }
    .skeleton-image, .skeleton-lines i { display: block; background: linear-gradient(100deg, color-mix(in srgb, var(--line) 40%, var(--surface)) 20%, color-mix(in srgb, var(--line) 75%, var(--surface)) 38%, color-mix(in srgb, var(--line) 40%, var(--surface)) 60%); background-size: 200% 100%; animation: shimmer 1.35s linear infinite; }
    .skeleton-image { aspect-ratio: 1.72; }
    .skeleton-lines { display: grid; gap: 10px; padding: 18px; }
    .skeleton-lines i { height: 10px; }
    .skeleton-lines i:first-child { width: 35%; height: 7px; }
    .skeleton-lines i:last-child { width: 70%; }
    @keyframes shimmer { to { background-position: -200% 0; } }
    .state-panel { display: flex; align-items: center; gap: 16px; min-height: 180px; padding: 25px; margin-top: 20px; border: 1px solid var(--line); background: var(--surface); }
    .state-mark { display: grid; place-items: center; width: 42px; height: 42px; flex: 0 0 auto; border: 1px solid var(--line); border-radius: 50%; color: var(--accent); font-family: 'Newsreader', Georgia, serif; font-size: 22px; }
    .state-panel h3 { margin: 0; font-family: 'Newsreader', Georgia, serif; font-size: 24px; font-weight: 500; }
    .state-panel p { margin: 6px 0 10px; color: var(--muted); font-size: 12px; }
    .text-button { padding: 0; border: 0; background: transparent; color: var(--accent); font-size: 11px; font-weight: 700; cursor: pointer; }
    .partial-warning { margin-top: 15px; padding: 10px 12px; border-left: 2px solid var(--accent); background: var(--accent-soft); color: var(--ink); font-size: 11px; }
    .partial-warning summary { cursor: pointer; }
    .partial-warning ul { display: grid; gap: 5px; padding-left: 20px; margin: 10px 0 0; }
    .source-credits { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; padding: 23px 0; margin-top: 20px; border-top: 1px solid var(--line); color: var(--muted); font-size: 9px; letter-spacing: .08em; }
    .source-credits > span:first-child { color: var(--accent); font-weight: 700; }
    .credit-name { color: var(--ink); font-weight: 600; letter-spacing: 0; }
    .page-footer { display: flex; justify-content: space-between; gap: 16px; padding: 17px 0 22px; border-top: 1px solid var(--line); color: var(--muted); font-size: 9px; }
    .page-footer span:first-child { color: var(--accent); font-weight: 700; letter-spacing: .1em; }
    @media (min-width: 1100px) { .story-grid app-news-card:first-child { max-height: 450px; } }
    @media (max-width: 860px) { .edition { display: none; } .story-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .story-grid app-news-card:first-child { grid-column: span 2; grid-row: auto; } .intro { min-height: 285px; } .edition-stamp { margin-right: 20px; } }
    @media (max-width: 600px) { .page-shell { padding-inline: 16px; } .masthead { min-height: 60px; } .brand-name { font-size: 16px; } .auto-status { display: none; } .intro { min-height: 270px; padding-block: 38px 30px; } .intro h1 { font-size: 62px; } .intro-deck { max-width: 260px; font-size: 12px; } .edition-stamp { position: absolute; right: 0; top: 49px; width: 72px; height: 72px; margin: 0; font-size: 5px; } .edition-stamp strong { font-size: 28px; } .edition-stamp i { right: 3px; top: 10px; } .intro-note { display: none; } .feed-section { padding-top: 27px; } .section-heading h2 { font-size: 28px; } .feed-status { gap: 8px; font-size: 9px; } .refresh-button { min-height: 35px; padding-inline: 9px; } .category-nav { gap: 22px; margin-top: 18px; } .filters { flex-wrap: wrap; gap: 8px 14px; padding-block: 11px; } .search-field { flex-basis: 100%; max-width: none; } .source-filter { flex: 1; } .source-filter select { flex: 1; max-width: none; } .story-grid { grid-template-columns: 1fr; gap: 12px; padding-top: 14px; } .story-grid app-news-card:first-child { grid-column: auto; } .page-footer { flex-wrap: wrap; } .page-footer span:last-child { display: none; } }
    @media (max-width: 860px) { .edition { display: flex; } }
    @media (max-width: 600px) { .masthead { gap: 8px; } .edition { gap: 5px; font-size: 8px; letter-spacing: .04em; white-space: nowrap; } .edition-rule, .edition-date { display: none; } .header-actions { gap: 0; } }
  `],
})
export class NewsFeedPage implements OnInit, OnDestroy {
    readonly store = inject(NewsFeedStore);
    readonly selectedCategory = signal<NewsCategory | 'all'>('all');
    readonly selectedSource = signal('all');
    readonly query = signal('');
    readonly today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
    readonly visibleCategories = computed(() => categories.filter((category) =>
        category.id === 'all' || this.store.articles().some((article) => article.category === category.id)));
    readonly editionLabel = computed(() => {
        const activeSources = this.store.sourceStatus().filter((source) => source.ok).map((source) => source.name);
        const isSerbiaSource = (source: string) => /^(n1 serbia|danas|blic|politika|rts|b92)$/i.test(source);
        const hasSerbia = activeSources.some(isSerbiaSource);
        const hasGlobal = activeSources.some((source) => !isSerbiaSource(source));
        if (hasGlobal && hasSerbia) return 'Global + Serbia';
        if (hasSerbia) return 'Serbia edition';
        return hasGlobal ? 'Global edition' : 'News edition';
    });
    readonly unavailableSources = computed(() => this.store.sourceStatus().filter((source) => !source.ok).map((source) => source.name).join(', '));
    readonly unavailableSourceStatuses = computed(() => this.store.sourceStatus().filter((source) => !source.ok));
    readonly filteredArticles = computed(() => {
        const since = Date.now() - 24 * 60 * 60 * 1000;
        const query = this.query().trim().toLowerCase();
        return this.store.articles().filter((article) => {
            const isToday = new Date(article.publishedAt).getTime() >= since;
            const matchesCategory = this.selectedCategory() === 'all' || article.category === this.selectedCategory();
            const matchesSource = this.selectedSource() === 'all' || (article.sources ?? [article.source]).includes(this.selectedSource());
            const matchesQuery = !query || `${article.title} ${article.summary} ${article.source} ${(article.sources ?? []).join(' ')}`.toLowerCase().includes(query);
            return isToday && matchesCategory && matchesSource && matchesQuery;
        });
    });
    private refreshTimer?: ReturnType<typeof setInterval>;

    ngOnInit(): void {
        void this.store.refresh();
        this.refreshTimer = setInterval(() => void this.store.refresh(), 10 * 60 * 1000);
    }

    ngOnDestroy(): void { if (this.refreshTimer) clearInterval(this.refreshTimer); }
    refresh(): void { void this.store.refresh(); }
    clearFilters(): void { this.selectedCategory.set('all'); this.selectedSource.set('all'); this.query.set(''); }
}
