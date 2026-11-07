import { Component, signal } from '@angular/core';

type Theme = 'light' | 'dark';

@Component({
    selector: 'app-theme-toggle',
    standalone: true,
    template: `
    <button class="theme-button" type="button" (click)="toggle()" [attr.aria-label]="'Switch to ' + nextTheme() + ' mode'" [title]="'Switch to ' + nextTheme() + ' mode'">
      <span class="theme-icon" aria-hidden="true">{{ theme() === 'light' ? '☼' : '◐' }}</span>
      <span>{{ theme() === 'light' ? 'Light' : 'Dark' }}</span>
    </button>
  `,
    styles: [`
    .theme-button { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 3px; background: var(--surface); color: var(--ink); cursor: pointer; }
    .theme-button:hover { border-color: var(--accent); }
    .theme-icon { color: var(--accent); font-size: 18px; line-height: 1; }
  `],
})
export class ThemeToggle {
    readonly theme = signal<Theme>(this.readTheme());
    readonly nextTheme = () => this.theme() === 'light' ? 'dark' : 'light';

    constructor() { this.applyTheme(this.theme()); }

    toggle(): void {
        const theme = this.nextTheme() as Theme;
        this.theme.set(theme);
        this.applyTheme(theme);
        localStorage.setItem('newsroom-theme', theme);
    }

    private readTheme(): Theme {
        const saved = localStorage.getItem('newsroom-theme');
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    private applyTheme(theme: Theme): void { document.documentElement.dataset['theme'] = theme; }
}
