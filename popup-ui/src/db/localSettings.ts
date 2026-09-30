import { db } from "./schema";
import type { LocalSettings } from "./schema";

export const localSettingsDb = {
  async setPaths(url: string, selectedPaths: string[]): Promise<void> {
    await db.transaction("rw", db.localSettings, async () => {
      const existing = await db.localSettings.get(url);
      await db.localSettings.put({ url, type: null, extractedData: null, ...existing, selectedPaths });
    });
  },
  /**
   * Get local settings for a specific URL
   */
  async get(url: string): Promise<LocalSettings | undefined> {
    return await db.localSettings.get(url);
  },

  /**
   * Create or update local settings for a URL
   */
  async upsert(settings: LocalSettings): Promise<string> {
    return await db.localSettings.put(settings);
  },

  /**
   * Update specific fields for a URL
   */
  async update(
    url: string,
    updates: Partial<Omit<LocalSettings, "url">>
  ): Promise<number> {
    return await db.localSettings.update(url, updates);
  },

  /**
   * Add a path to selectedPaths for a URL
   */
  async addPath(url: string, path: string): Promise<void> {
    const settings = await db.localSettings.get(url);
    if (settings) {
      const updatedPaths = [...settings.selectedPaths, path];
      await db.localSettings.update(url, { selectedPaths: updatedPaths });
    } else {
      // Create new entry if doesn't exist
      await db.localSettings.put({
        url,
        type: null,
        extractedData: null,
        selectedPaths: [path],
      });
    }
  },

  /**
   * Remove a path from selectedPaths for a URL
   */
  async removePath(url: string, path: string): Promise<void> {
    const settings = await db.localSettings.get(url);
    if (settings) {
      const updatedPaths = settings.selectedPaths.filter((p) => p !== path);
      await db.localSettings.update(url, { selectedPaths: updatedPaths });
    }
  },

  /**
   * Get all local settings
   */
  async getAll(): Promise<LocalSettings[]> {
    return await db.localSettings.toArray();
  },

  /**
   * Delete local settings for a URL
   */
  async delete(url: string): Promise<void> {
    await db.localSettings.delete(url);
  },

  /**
   * Clear all local settings
   */
  async clear(): Promise<void> {
    await db.localSettings.clear();
  },
};
