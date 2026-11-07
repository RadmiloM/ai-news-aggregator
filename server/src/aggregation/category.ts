import { NewsCategory } from '../types/article.js';

const categoryPatterns: [NewsCategory, RegExp][] = [
    ['tech', /\b(technology|tech|artificial intelligence|ai|software|cyber|smartphone|chip|robot|startup)\b/i],
    ['business', /\b(business|market|economy|economic|stock|trade|company|finance|bank|inflation|jobs)\b/i],
    ['sports', /\b(sport|football|soccer|basketball|tennis|olympic|championship|league|tournament|cricket)\b/i],
    ['science', /\b(science|research|climate|space|health|medical|study|scientist|environment|energy)\b/i],
    ['culture', /\b(culture|film|movie|music|book|art|museum|television|festival|celebrity)\b/i],
    ['world', /\b(world|international|global|war|election|government|president|minister|diplomat|protest)\b/i],
];

export function inferCategory(title: string, summary = '', hint = ''): NewsCategory {
    const text = `${hint} ${title} ${summary}`;
    for (const [category, pattern] of categoryPatterns) if (pattern.test(text)) return category;
    return 'other';
}
