import { describe, expect, it, vi } from 'vitest';
import { RequestRouter, type PendingRequest } from '../src/worker/requestRouter';
import { MessageTypes } from '../src/actions/types';
function request(id: string, url: string, kind: PendingRequest['kind'] = 'investigation'): PendingRequest {
  return { requestId: id, sessionId: `session-${id}`, url, kind, text: '', toolUsage: [], resume: false };
}
function fixture() {
  const broadcast = vi.fn();
  const saveSummary = vi.fn(async () => {});
  const saveInvestigation = vi.fn(async (request: PendingRequest, text: string) => ({ url: request.url, sessionId: request.sessionId, data: text, toolUsage: request.toolUsage }));
  return { router: new RequestRouter({ broadcast, saveSummary, saveInvestigation }), broadcast, saveSummary, saveInvestigation };
}
describe('native response routing', () => {
  it('routes concurrent summary completions by request ID', async () => {
    const { router, saveSummary } = fixture();
    router.start(request('first', 'https://jira/first', 'summary')); router.start(request('second', 'https://jira/second', 'summary'));
    await router.handle({ type: 'SUMMARIZE_HOST_COMPLETE', requestId: 'first', text: 'First summary' });
    await router.handle({ type: 'SUMMARIZE_HOST_COMPLETE', requestId: 'second', text: 'Second summary' });
    expect(saveSummary.mock.calls).toEqual([['https://jira/first', 'First summary'], ['https://jira/second', 'Second summary']]);
  });
  it('keeps streams and tools on the correct page and ignores mismatched sessions', async () => {
    const { router, broadcast, saveInvestigation } = fixture();
    router.start(request('first', 'first')); router.start(request('second', 'second'));
    await router.handle({ type: 'ASK_HOST_STREAM', requestId: 'first', sessionId: 'wrong', text: 'Wrong' });
    await router.handle({ type: 'ASK_HOST_STREAM', requestId: 'second', text: 'Correct' });
    await router.handle({ type: 'ASK_HOST_PROGRESS', requestId: 'second', text: '  ⎿ Completed' });
    expect(router.state('first', 'investigation')?.text).toBe('');
    expect(router.state('second', 'investigation')?.text).toBe('Correct');
    expect(broadcast.mock.calls[0][0].url).toBe('second');
    expect(router.state('second', 'investigation')?.toolUsage[0].type).toBe('tool_result');
    await router.handle({ type: 'ASK_HOST_COMPLETE', requestId: 'second', text: 'Correct' });
    expect(saveInvestigation.mock.calls[0][0].url).toBe('second');
  });
  it('broadcasts completion only after persistence and ignores duplicate completion events', async () => {
    const broadcast = vi.fn();
    let release!: () => void;
    const persisted = new Promise<void>((resolve) => { release = resolve; });
    const router = new RequestRouter({ broadcast, saveSummary: () => persisted, saveInvestigation: vi.fn() });
    router.start(request('one', 'page', 'summary'));
    const completing = router.handle({ type: 'SUMMARIZE_HOST_COMPLETE', requestId: 'one', text: 'saved' });
    await router.handle({ type: 'SUMMARIZE_HOST_COMPLETE', requestId: 'one', text: 'duplicate' });
    expect(broadcast).not.toHaveBeenCalled();
    release(); await completing;
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(router.state('page', 'summary')).toBeUndefined();
  });
  it('reports storage failures and disconnection for every pending page', async () => {
    const { router, saveSummary, broadcast } = fixture();
    saveSummary.mockRejectedValueOnce(new Error('Storage full'));
    router.start(request('one', 'first', 'summary'));
    await router.handle({ type: 'SUMMARIZE_HOST_COMPLETE', requestId: 'one', text: 'saved' });
    expect(broadcast.mock.calls[0][0]).toMatchObject({ type: MessageTypes.SUMMARIZE_CONTENT_ERROR, url: 'first', data: 'Storage full' });
    router.start(request('two', 'second')); router.start(request('three', 'third', 'summary'));
    router.disconnect('Host disconnected');
    expect(broadcast.mock.calls.slice(1).map(([message]) => message.url)).toEqual(['second', 'third']);
    expect(router.state('second', 'investigation')).toBeUndefined();
  });
  it('rejects overlapping investigations for the same page', () => {
    const { router } = fixture(); router.start(request('one', 'page'));
    expect(() => router.start(request('two', 'page'))).toThrow(/already running/);
  });
});
