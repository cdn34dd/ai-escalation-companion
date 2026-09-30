import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InvestigationScreen from '../src/components/InvestigationScreen';
import SummarizeScreen from '../src/screens/SummarizeScreen';
import { MessageRecipients, MessageTypes, type Message } from '../src/actions/types';

const listeners = new Set<(message: Message) => void>();
let sendMessage: ReturnType<typeof vi.fn>;
beforeEach(() => {
  listeners.clear();
  sendMessage = vi.fn(async (message: Message) => message.type === MessageTypes.REQUEST_STATE_START
    ? { pending: null }
    : { success: true, sessionId: 'current-session' });
  vi.stubGlobal('chrome', { runtime: { sendMessage, onMessage: { addListener: (listener: (message: Message) => void) => listeners.add(listener), removeListener: (listener: (message: Message) => void) => listeners.delete(listener) } } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function emit(message: Message) { act(() => { for (const listener of listeners) listener(message); }); }
function starts() { return sendMessage.mock.calls.map(([message]) => message as Message).filter((message) => message.type === MessageTypes.INVESTIGATION_START || message.type === MessageTypes.SUMMARIZE_CONTENT_START); }

describe('request recovery in the UI', () => {
  it('starts an automatic investigation only once in React StrictMode', async () => {
    render(<StrictMode><InvestigationScreen url="page" mode="new" extractedContent="ticket" /></StrictMode>);
    await waitFor(() => expect(starts()).toHaveLength(1));
    expect(screen.getByRole('status').textContent).toContain('Starting investigation');
  });
  it('ignores other pages and clears the loading state on a matching error', async () => {
    render(<InvestigationScreen url="page" mode="new" extractedContent="ticket" />);
    await waitFor(() => expect(starts()).toHaveLength(1));
    const request = starts()[0];
    emit({ type: MessageTypes.INVESTIGATION_STREAM, recipient: MessageRecipients.POPUP, requestId: request.requestId, url: 'other-page', data: 'Wrong response' });
    expect(screen.queryByText('Wrong response')).toBeNull();
    emit({ type: MessageTypes.INVESTIGATION_ERROR, recipient: MessageRecipients.POPUP, requestId: request.requestId, url: 'page', data: 'Native host disconnected' });
    expect(screen.getByRole('alert').textContent).toContain('Native host disconnected');
    expect(screen.queryByRole('status')).toBeNull();
    expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(false);
  });
  it('reattaches to an existing request without starting a duplicate', async () => {
    sendMessage.mockResolvedValueOnce({ pending: { requestId: 'pending', sessionId: 'session', text: 'Already streaming', toolUsage: [], resume: false } });
    render(<InvestigationScreen url="page" mode="new" extractedContent="ticket" />);
    await waitFor(() => expect(screen.getByText('Already streaming')).toBeTruthy());
    expect(starts()).toHaveLength(0);
    emit({ type: MessageTypes.INVESTIGATION_COMPLETE, recipient: MessageRecipients.POPUP, requestId: 'pending', sessionId: 'session', url: 'page', data: 'Final persisted response' });
    expect(screen.getByText('Final persisted response')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('preserves newlines in resumed chat input and sends a correlated follow-up', async () => {
    sendMessage.mockResolvedValueOnce({ pending: null, investigation: { url: 'page', sessionId: 'saved-session', data: 'Saved answer', toolUsage: [] } });
    render(<InvestigationScreen url="page" mode="resume" extractedContent={null} />);
    await waitFor(() => expect(screen.getByText('Saved answer')).toBeTruthy());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Follow up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(starts()).toHaveLength(1));
    expect(starts()[0]).toMatchObject({ url: 'page', sessionId: 'saved-session', userQuestion: '> Follow up', data: 'Follow up' });
    expect(starts()[0].requestId).toBeTruthy();
  });
  it('reports summary errors and permits a retry', async () => {
    render(<SummarizeScreen url="page" extractedContent="ticket" />);
    await waitFor(() => expect(starts()).toHaveLength(1));
    emit({ type: MessageTypes.SUMMARIZE_CONTENT_ERROR, recipient: MessageRecipients.POPUP, requestId: starts()[0].requestId, url: 'page', data: 'Summary failed' });
    expect(screen.getByRole('alert').textContent).toBe('Summary failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(starts()).toHaveLength(2));
  });
});
