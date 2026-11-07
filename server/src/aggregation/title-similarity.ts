const ignoredWords = new Set(['about', 'after', 'against', 'among', 'and', 'are', 'but', 'for', 'from', 'have', 'into', 'its', 'more', 'over', 'said', 'says', 'that', 'the', 'their', 'this', 'was', 'were', 'with', 'will']);

export function normalizeTitle(title: string): string {
    return title
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function tokens(title: string): Set<string> {
    return new Set(normalizeTitle(title).split(' ').filter((word) => word.length > 2 && !ignoredWords.has(word)));
}

export function titleSimilarity(left: string, right: string): number {
    const leftTokens = tokens(left);
    const rightTokens = tokens(right);
    if (leftTokens.size < 3 || rightTokens.size < 3) return 0;
    const intersection = [...leftTokens].filter((word) => rightTokens.has(word)).length;
    return intersection / (leftTokens.size + rightTokens.size - intersection);
}
