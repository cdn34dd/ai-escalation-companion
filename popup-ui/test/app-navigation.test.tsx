import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import { MessageTypes, type Message } from '../src/actions/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('updates the extracted ticket and request URL after switching active tabs', async () => {
  let tab = { id: 1, url: 'https://github.com/org/repo/issues/1' };
  const activated = new Set<() => void>();
  const runtime = new Set<(message: Message) => void>();
  const event = <T,>(listeners: Set<T>) => ({ addListener: (listener: T) => listeners.add(listener), removeListener: (listener: T) => listeners.delete(listener) });
  const sendMessage = vi.fn(async (message: Message) => {
    if (message.type === MessageTypes.DB_ACTION_START) return { success: true, data: [] };
    if (message.type === MessageTypes.REQUEST_STATE_START) return { pending: null };
    return { success: true, sessionId: `session-${message.url}` };
  });
  vi.stubGlobal('chrome', {
    tabs: { query: async () => [tab], sendMessage: async () => ({ type: MessageTypes.EXTRACTION_COMPLETE, url: tab.url, data: `Content for ${tab.id}` }), onActivated: event(activated), onUpdated: { addListener: vi.fn(), removeListener: vi.fn() } },
    runtime: { sendMessage, onMessage: event(runtime) },
  });
  render(<App />);
  await waitFor(() => expect(sendMessage).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: /New Investigation/ }));
  const starts = () => sendMessage.mock.calls.map(([message]) => message).filter((message) => message.type === MessageTypes.INVESTIGATION_START);
  await waitFor(() => expect(starts()).toHaveLength(1));
  expect(starts()[0]).toMatchObject({ url: tab.url, data: expect.stringContaining('Content for 1') });
  tab = { id: 2, url: 'https://github.com/org/repo/issues/2' };
  act(() => { for (const listener of activated) listener(); });
  await waitFor(() => expect(starts()).toHaveLength(2));
  expect(starts()[1]).toMatchObject({ url: tab.url, data: expect.stringContaining('Content for 2') });
});
