import { db } from "./schema";
import type { Summary } from "./schema";

export const summariesDb = {
  /**
   * Get summary for a specific URL
   */
  async get(url: string): Promise<Summary | undefined> {
    return await db.summaries.get(url);
  },

  /**
   * Create or update a summary for a URL
   */
  async upsert(summary: Summary): Promise<string> {
    return await db.summaries.put(summary);
  },

  /**
   * Update summary data for a URL
   */
  async update(url: string, data: string): Promise<number> {
    return await db.summaries.update(url, { data });
  },

  /**
   * Get all summaries
   */
  async getAll(): Promise<Summary[]> {
    return await db.summaries.toArray();
  },

  /**
   * Delete summary for a URL
   */
  async delete(url: string): Promise<void> {
    await db.summaries.delete(url);
  },

  /**
   * Clear all summaries
   */
  async clear(): Promise<void> {
    await db.summaries.clear();
  },

  /**
   * Check if summary exists for a URL
   */
  async exists(url: string): Promise<boolean> {
    const count = await db.summaries.where("url").equals(url).count();
    return count > 0;
  },
};
