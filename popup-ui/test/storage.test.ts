import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/schema';
import { executeDBAction } from '../src/db/dbActions';
import { extensionSettingsDb } from '../src/db/extensionSettings';
import { localSettingsDb } from '../src/db/localSettings';

afterEach(async () => { await Promise.all(db.tables.map((table) => table.clear())); });
describe('settings storage', () => {
  it('sets selected paths without losing ticket metadata', async () => {
    await db.localSettings.put({ url: 'page', type: 'JIRA', extractedData: 'ticket', selectedPaths: [] });
    expect(await executeDBAction({ collection: 'localSettings', method: 'setPaths', args: ['page', ['/project']] })).toMatchObject({ success: true });
    expect(await localSettingsDb.get('page')).toMatchObject({ type: 'JIRA', extractedData: 'ticket', selectedPaths: ['/project'] });
  });
  it('does not lose concurrently added paths or add duplicates', async () => {
    await Promise.all(['/a', '/b', '/a'].map((path) => extensionSettingsDb.addPath(path)));
    expect((await extensionSettingsDb.getPaths()).sort()).toEqual(['/a', '/b']);
  });
  it('removes deleted directories from every page selection', async () => {
    await extensionSettingsDb.setPaths(['/a', '/b']);
    await localSettingsDb.setPaths('first', ['/a', '/b']); await localSettingsDb.setPaths('second', ['/a']);
    await extensionSettingsDb.removePath('/a');
    expect(await extensionSettingsDb.getPaths()).toEqual(['/b']);
    expect((await localSettingsDb.get('first'))?.selectedPaths).toEqual(['/b']);
    expect((await localSettingsDb.get('second'))?.selectedPaths).toEqual([]);
  });
  it('rejects inherited methods rather than invoking arbitrary database properties', async () => {
    const result = await executeDBAction({ collection: 'localSettings', method: 'constructor' as never });
    expect(result.success).toBe(false);
  });
});

import { investigationsDb } from '../src/db/investigations';
describe('investigation history', () => {
  it('appends a follow-up and its tools exactly once without replacing previous history', async () => {
    const first = { timestamp: 1, message: 'Read first', type: 'tool_start' as const };
    const second = { timestamp: 2, message: 'Read second', type: 'tool_start' as const };
    await investigationsDb.completeTurn({ url: 'page', sessionId: 'one', resume: false, toolUsage: [first] }, 'First answer');
    const saved = await investigationsDb.completeTurn({ url: 'page', sessionId: 'one', resume: true, userQuestion: '> Follow-up', toolUsage: [second] }, 'Second answer');
    expect(saved.data).toBe('First answer\n\n> Follow-up\n\nSecond answer');
    expect(saved.toolUsage).toEqual([first, second]);
    expect(await investigationsDb.get('page')).toEqual(saved);
  });
  it('replaces old history for a new session and rejects a stale session', async () => {
    await investigationsDb.completeTurn({ url: 'page', sessionId: 'old', resume: false, toolUsage: [] }, 'Old answer');
    await investigationsDb.completeTurn({ url: 'page', sessionId: 'new', resume: false, toolUsage: [] }, 'New answer');
    await expect(investigationsDb.completeTurn({ url: 'page', sessionId: 'old', resume: true, toolUsage: [] }, 'Stale')).rejects.toThrow(/session has changed/);
    expect((await investigationsDb.get('page'))?.data).toBe('New answer');
  });
});
