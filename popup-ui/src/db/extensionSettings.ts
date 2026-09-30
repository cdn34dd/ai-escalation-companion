import { db } from "./schema";
import type { ExtensionSettings } from "./schema";

const SINGLETON_ID = 1;

export const extensionSettingsDb = {
  /**
   * Get the extension settings (singleton)
   */
  async get(): Promise<ExtensionSettings | undefined> {
    return await db.extensionSettings.get(SINGLETON_ID);
  },

  /**
   * Initialize or update extension settings
   */
  async upsert(settings: Omit<ExtensionSettings, "id">): Promise<number> {
    return await db.extensionSettings.put({
      id: SINGLETON_ID,
      ...settings,
    });
  },

  /**
   * Update specific fields
   */
  async update(
    updates: Partial<Omit<ExtensionSettings, "id">>
  ): Promise<number> {
    return await db.extensionSettings.update(SINGLETON_ID, updates);
  },

  /**
   * Get all paths
   */
  async getPaths(): Promise<string[]> {
    const settings = await db.extensionSettings.get(SINGLETON_ID);
    return settings?.paths || [];
  },

  /**
   * Set all paths (replaces existing)
   */
  async setPaths(paths: string[]): Promise<void> {
    const settings = await db.extensionSettings.get(SINGLETON_ID);
    if (settings) {
      await db.extensionSettings.update(SINGLETON_ID, { paths });
    } else {
      await db.extensionSettings.put({
        id: SINGLETON_ID,
        paths,
      });
    }
  },

  /**
   * Add a path to the paths array
   */
  async addPath(path: string): Promise<void> {
    await db.transaction("rw", db.extensionSettings, async () => {
      const paths = await this.getPaths();
      if (!paths.includes(path)) await this.setPaths([...paths, path]);
    });
  },

  async removePath(path: string): Promise<void> {
    await db.transaction("rw", db.extensionSettings, db.localSettings, async () => {
      await this.setPaths((await this.getPaths()).filter((value) => value !== path));
      await db.localSettings.toCollection().modify((settings) => {
        settings.selectedPaths = settings.selectedPaths.filter((value) => value !== path);
      });
    });
  },

  /**
   * Clear all paths
   */
  async clearPaths(): Promise<void> {
    await this.setPaths([]);
  },

  /**
   * Initialize with default values if not exists
   */
  async initialize(): Promise<void> {
    const existing = await this.get();
    if (!existing) {
      await db.extensionSettings.put({
        id: SINGLETON_ID,
        paths: [],
      });
    }
  },
};
