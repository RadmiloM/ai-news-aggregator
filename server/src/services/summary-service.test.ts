import { describe, expect, it, vi } from 'vitest';
import { SummaryService } from './summary-service.js';

const input = { id: 'abc', title: 'A new climate report is published', summary: 'The report details a new target.', source: 'BBC', url: 'https://news.example/report' };
const limits = { apiKey: 'test-key', model: 'gemini-test', requestsPerMinute: 10, requestsPerDay: 10, perIpPerMinute: 5, concurrency: 2, queueLimit: 2 };

describe('SummaryService', () => {
    it('generates once and caches summaries by canonical article URL', async () => {
        const generator = vi.fn(async () => 'A report sets out new climate targets. It details the expected timeline.');
        const service = new SummaryService({ ...limits, generator });
        const first = await service.summarize(input, '127.0.0.1');
        const cached = await service.summarize({ ...input, id: 'different-id', url: 'https://news.example/report?utm_source=feed' }, '127.0.0.1');
        expect(first.generated).toBe(true);
        expect(cached).toEqual(first);
        expect(generator).toHaveBeenCalledTimes(1);
    });

    it('falls back to the publisher description when Gemini fails or is not configured', async () => {
        const failed = new SummaryService({ ...limits, generator: async () => { throw new Error('quota'); } });
        const unavailable = new SummaryService({ ...limits, apiKey: '' });
        expect(await failed.summarize(input)).toEqual({ summary: input.summary, generated: false });
        expect(await unavailable.summarize(input)).toEqual({ summary: input.summary, generated: false });
    });

    it('enforces per-IP and daily request limits without losing the fallback', async () => {
        const service = new SummaryService({ ...limits, requestsPerDay: 1, generator: async () => 'A concise summary. Another sentence.' });
        expect((await service.summarize(input, 'ip-a')).generated).toBe(true);
        const otherStory = { ...input, id: 'second', url: 'https://news.example/second' };
        expect(await service.summarize(otherStory, 'ip-b')).toEqual({ summary: input.summary, generated: false });
    });

    it('bounds queued work when all Gemini slots and the queue are occupied', async () => {
        let release!: () => void;
        const generator = vi.fn(() => new Promise<string>((resolve) => { release = () => resolve('First sentence. Second sentence.'); }));
        const service = new SummaryService({ ...limits, concurrency: 1, queueLimit: 1, generator });
        const first = service.summarize({ ...input, id: 'one' }, 'ip-a');
        await vi.waitFor(() => expect(generator).toHaveBeenCalledTimes(1));
        const second = service.summarize({ ...input, id: 'two' }, 'ip-b');
        const overflow = await service.summarize({ ...input, id: 'three' }, 'ip-c');
        expect(overflow.generated).toBe(false);
        release();
        await vi.waitFor(() => expect(generator).toHaveBeenCalledTimes(2));
        release();
        expect((await first).generated).toBe(true);
        expect((await second).generated).toBe(true);
    });
});
