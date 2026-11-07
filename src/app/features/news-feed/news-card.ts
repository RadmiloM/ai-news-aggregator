import { DatePipe } from '@angular/common';
import { Component, inject, Input, signal } from '@angular/core';
import { Article } from '../../core/models/article.model';
import { NewsFeedStore } from '../../core/services/news-feed.store';

@Component({
    selector: 'app-news-card',
    standalone: true,
    imports: [DatePipe],
    template: `
    <article class="story" [class.story-featured]="featured">
      <a class="story-image" [href]="article.url" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'Read ' + article.title + ' at ' + article.source">
        @if (article.imageUrl && !imageFailed()) {
          <img [src]="article.imageUrl" alt="" loading="lazy" (error)="imageFailed.set(true)" />
        } @else {
          <span class="image-fallback" aria-hidden="true"><i></i><b></b><em></em></span>
        }
        <span class="image-category">{{ article.category }}</span>
      </a>
      <div class="story-copy">
        <div class="story-meta">
          <span class="source-name">{{ article.source }}</span><span class="meta-dot"></span>
          <time [attr.datetime]="article.publishedAt">{{ article.publishedAt | date: 'shortTime' }}</time>
          @if ((article.sources?.length ?? 0) > 1) { <span class="coverage">{{ article.sources?.length }} sources</span> }
        </div>
        <h2><a [href]="article.url" target="_blank" rel="noopener noreferrer">{{ article.title }}</a></h2>
        @if (featured) { <p class="story-deck">{{ article.summary }}</p> }
        <div class="story-actions">
          <button type="button" class="summary-button" (click)="toggleSummary()" [attr.aria-expanded]="expanded()">
            {{ expanded() ? 'Hide summary' : 'AI summary' }} <span aria-hidden="true">{{ expanded() ? '−' : '+' }}</span>
          </button>
          <a class="read-link" [href]="article.url" target="_blank" rel="noopener noreferrer">Read story <span aria-hidden="true">↗</span></a>
        </div>
        @if (expanded()) {
          <div class="summary-panel" aria-live="polite">
            <span class="summary-label">THE SHORT VERSION</span>
            @if (article.aiSummary) {
              <p>{{ article.aiSummary }}</p>
            } @else {
              <p>{{ article.summary || 'No publisher description is available.' }}</p>
              <button type="button" class="generate-button" (click)="requestSummary()" [disabled]="summarizing()">
                {{ summarizing() ? 'Preparing summary…' : 'Generate two-sentence summary' }}
              </button>
            }
          </div>
        }
      </div>
    </article>
  `,
    styles: [`
    :host { display: block; min-width: 0; }
    .story { display: grid; grid-template-columns: minmax(0, 1fr); height: 100%; background: var(--surface-raised); border: 1px solid var(--line); animation: rise-in .45s both; }
    .story-featured { grid-template-columns: minmax(0, 1.08fr) minmax(250px, .92fr); }
    .story-image { position: relative; display: block; aspect-ratio: 1.72; overflow: hidden; background: linear-gradient(135deg, #53645d, #b2a88f 48%, #c77b5d); }
    .story-featured .story-image { aspect-ratio: auto; min-height: 310px; }
    .story-image img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .6s cubic-bezier(.2,.7,.2,1); }
    .story-image:hover img { transform: scale(1.035); }
    .image-category { position: absolute; bottom: 12px; left: 12px; padding: 6px 9px; color: #fff; background: rgb(25 31 27 / 78%); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .image-fallback { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(120deg, #40594e 0%, #7f8972 48%, #c88d68 100%); }
    .image-fallback i, .image-fallback b, .image-fallback em { position: absolute; display: block; border-radius: 50%; }
    .image-fallback i { width: 42%; aspect-ratio: 1; top: 14%; right: 12%; background: #e3c88a; opacity: .8; }
    .image-fallback b { width: 90%; height: 82%; left: -12%; bottom: -48%; background: #354d43; transform: rotate(-18deg); border-radius: 48% 52% 0 0; }
    .image-fallback em { width: 75%; height: 56%; right: -15%; bottom: -39%; background: #586454; transform: rotate(20deg); border-radius: 48% 48% 0 0; }
    .story-copy { display: flex; flex-direction: column; padding: 18px 19px 16px; min-width: 0; }
    .story-featured .story-copy { justify-content: center; padding: clamp(20px, 3vw, 38px); }
    .story-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--muted); font-size: 11px; }
    .source-name { color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: .07em; }
    .meta-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--muted); }
    .coverage { margin-left: auto; color: var(--olive); }
    h2 { margin: 12px 0 0; font-family: 'Newsreader', Georgia, serif; font-size: clamp(21px, 2vw, 27px); font-weight: 500; line-height: 1.16; }
    h2 a { text-decoration: none; text-decoration-color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 4px; }
    h2 a:hover { text-decoration: underline; }
    .story-featured h2 { max-width: 22ch; font-size: clamp(28px, 3.2vw, 43px); line-height: 1.08; }
    .story-deck { margin: 14px 0 0; color: var(--muted); font-size: 14px; line-height: 1.65; }
    .story-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: auto; padding-top: 19px; }
    .summary-button, .read-link { display: inline-flex; align-items: center; gap: 7px; color: var(--ink); text-decoration: none; font-size: 11px; font-weight: 600; }
    .summary-button { padding: 0; border: 0; background: transparent; cursor: pointer; }
    .summary-button span, .read-link span { color: var(--accent); font-size: 16px; }
    .read-link:hover { color: var(--accent); }
    .summary-panel { margin-top: 17px; padding-top: 14px; border-top: 1px solid var(--line); animation: reveal .25s ease both; }
    .summary-label { color: var(--accent); font-size: 9px; font-weight: 700; letter-spacing: .12em; }
    .summary-panel p { margin: 7px 0 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
    .generate-button { margin-top: 9px; padding: 0; border: 0; background: transparent; color: var(--accent); font-size: 11px; font-weight: 700; cursor: pointer; }
    .generate-button:disabled { opacity: .6; cursor: wait; }
    @keyframes rise-in { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes reveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 680px) { .story-featured { grid-template-columns: 1fr; } .story-featured .story-image { aspect-ratio: 1.6; min-height: 0; } .story-featured .story-copy { padding: 20px; } .story-featured h2 { font-size: 29px; } }
  `],
})
export class NewsCard {
    private readonly store = inject(NewsFeedStore);
    @Input({ required: true }) article!: Article;
    @Input() featured = false;
    readonly expanded = signal(false);
    readonly summarizing = signal(false);
    readonly imageFailed = signal(false);

    toggleSummary(): void { this.expanded.update((value) => !value); }

    async requestSummary(): Promise<void> {
        if (this.summarizing() || this.article.aiSummary) return;
        this.summarizing.set(true);
        await this.store.summarize(this.article);
        this.summarizing.set(false);
    }
}
