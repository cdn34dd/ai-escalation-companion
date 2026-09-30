import { db } from "./schema";
import type { Investigation, ToolUsageEntry } from "./schema";

export const investigationsDb = {
  async completeTurn(request: { url: string; sessionId: string; resume: boolean; userQuestion?: string; toolUsage: ToolUsageEntry[] }, text: string): Promise<Investigation> {
    return db.transaction("rw", db.investigations, async () => {
      const existing = request.resume ? await db.investigations.get(request.url) : undefined;
      if (request.resume && (!existing || existing.sessionId !== request.sessionId)) {
        throw new Error("The saved investigation session has changed. Reopen the investigation.");
      }
      const turn = [request.userQuestion, text].filter(Boolean).join("\n\n");
      const investigation = {
        url: request.url, sessionId: request.sessionId,
        data: [existing?.data, turn].filter(Boolean).join("\n\n"),
        toolUsage: [...(existing?.toolUsage || []), ...request.toolUsage],
      };
      await db.investigations.put(investigation);
      return investigation;
    });
  },
  /**
   * Get investigation for a specific URL
   */
  async get(url: string): Promise<Investigation | undefined> {
    return await db.investigations.get(url);
  },

  /**
   * Create or update an investigation for a URL
   */
  async upsert(investigation: Investigation): Promise<string> {
    return await db.investigations.put(investigation);
  },

  /**
   * Update investigation data for a URL
   */
  async update(
    url: string,
    updates: Partial<Omit<Investigation, "url">>
  ): Promise<number> {
    return await db.investigations.update(url, updates);
  },

  /**
   * Get all investigations
   */
  async getAll(): Promise<Investigation[]> {
    return await db.investigations.toArray();
  },

  /**
   * Get investigations by sessionId
   */
  async getBySessionId(sessionId: string): Promise<Investigation[]> {
    return await db.investigations.where("sessionId").equals(sessionId).toArray();
  },

  /**
   * Delete investigation for a URL
   */
  async delete(url: string): Promise<void> {
    await db.investigations.delete(url);
  },

  /**
   * Clear all investigations
   */
  async clear(): Promise<void> {
    await db.investigations.clear();
  },

  /**
   * Check if investigation exists for a URL
   */
  async exists(url: string): Promise<boolean> {
    const count = await db.investigations.where("url").equals(url).count();
    return count > 0;
  },
};
