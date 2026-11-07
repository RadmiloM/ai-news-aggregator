import { NewsCategory } from '../types/article.js';

const categoryPatterns: [NewsCategory, RegExp][] = [
    ['tech', /\b(technology|tech|tecnolog\w*|tehnolog\w*|artificial intelligence|ai|software|cyber|smartphone|chip|robot|startup)\b/],
    ['business', /\b(business|biznis|privred\w*|market|trzist\w*|economy|economic|ekonom\w*|stock|trade|company|financ\w*|bank|inflation|jobs)\b/],
    ['sports', /\b(sport\w*|football|soccer|fudbal\w*|basketball|kosark\w*|tennis|tenis|olympic|championship|league|tournament|cricket)\b/],
    ['science', /\b(science|nauk\w*|research|istraziv\w*|climate|klim\w*|space|svemir\w*|health|medical|zdrav\w*|study|scientist|environment|energy)\b/],
    ['serbia', /\b(serbia|srbija|srbije)\b/],
    ['world', /\b(world|svet|svijet|international|global|politic\w*|politik\w*|war|rat|election|izbor\w*|government|vlada|president|predsednik|minister|diplomat|protest)\b/],
];

const directCategoryPatterns: [NewsCategory, RegExp][] = [
    ['world', /\b(world|svet|svijet|international|global|politics?|politika)\b/],
    ['business', /\b(business|biznis|economy|ekonomija|markets?)\b/],
    ['tech', /\b(tech|technology|tehnologija)\b/],
    ['sports', /\b(sports?|sport|fudbal|football)\b/],
    ['science', /\b(science|nauka|research|istraživanje)\b/],
    ['serbia', /\b(serbia|srbija|srbije)\b/],
];

function normalizeText(value: string): string {
    const cyrillic = value.replace(/[А-Яа-яЂђЈјЉљЊњЋћЏџ]/g, (character) => ({
        А: 'a', а: 'a', Б: 'b', б: 'b', В: 'v', в: 'v', Г: 'g', г: 'g', Д: 'd', д: 'd',
        Ђ: 'dj', ђ: 'dj', Е: 'e', е: 'e', Ж: 'z', ж: 'z', З: 'z', з: 'z', И: 'i', и: 'i',
        Ј: 'j', ј: 'j', К: 'k', к: 'k', Л: 'l', л: 'l', Љ: 'lj', љ: 'lj', М: 'm', м: 'm',
        Н: 'n', н: 'n', Њ: 'nj', њ: 'nj', О: 'o', о: 'o', П: 'p', п: 'p', Р: 'r', р: 'r',
        С: 's', с: 's', Т: 't', т: 't', Ћ: 'c', ћ: 'c', У: 'u', у: 'u', Ф: 'f', ф: 'f',
        Х: 'h', х: 'h', Ц: 'c', ц: 'c', Ч: 'c', ч: 'c', Џ: 'dz', џ: 'dz', Ш: 's', ш: 's',
    }[character] ?? character));
    return cyrillic.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isN1Story(source: string, url: URL): boolean {
    return url.hostname === 'n1info.rs' || url.hostname.endsWith('.n1info.rs') || /n1\s*serbia/i.test(source);
}

function n1SectionCategory(pathname: string): NewsCategory | null {
    const section = pathname.toLowerCase().split('/').filter(Boolean)[0];
    if (!section) return null;
    if (section === 'biznis') return 'business';
    if (section === 'sport') return 'sports';
    if (section === 'svet') return 'world';
    if (section === 'nauka') return 'science';
    if (section === 'tehnologija') return 'tech';
    if (section === 'scena') return 'serbia';
    return null;
}

export function inferCategory(title: string, summary = '', hint = '', url = '', source = ''): NewsCategory {
    const parsedUrl = (() => {
        try {
            return new URL(url);
        } catch {
            return null;
        }
    })();

    if (parsedUrl && isN1Story(source, parsedUrl)) {
        const sectionCategory = n1SectionCategory(parsedUrl.pathname);
        if (sectionCategory) return sectionCategory;
    }

    const normalizedHint = normalizeText(hint);
    for (const [category, pattern] of directCategoryPatterns) {
        if (pattern.test(normalizedHint)) return category;
    }

    const text = normalizeText(`${title} ${summary} ${parsedUrl?.pathname ?? ''}`);
    for (const [category, pattern] of categoryPatterns) if (pattern.test(text)) return category;

    return (parsedUrl && isN1Story(source, parsedUrl)) || /n1\s*serbia/i.test(source) ? 'serbia' : 'general';
}
