import Dexie from "dexie";
import type { Table } from "dexie";

export interface LocalSettings {
  url: string; // Primary key
  type: string | null; // e.g., "JIRA", "GITHUB", "ZENDESK"
  extractedData: string | null;
  selectedPaths: string[];
}

export interface ExtensionSettings {
  id: number; // Primary key, singleton (always 1)
  paths: string[];
}

export interface Summary {
  url: string; // Primary key
  data: string;
}

export interface ToolUsageEntry {
  timestamp: number;
  message: string;
  type: "tool_start" | "tool_result" | "thinking";
}

export interface Investigation {
  url: string; // Primary key
  sessionId: string | null;
  data: string;
  toolUsage?: ToolUsageEntry[]; // Array of tool usage messages with timestamps
}

export class AppDatabase extends Dexie {
  localSettings!: Table<LocalSettings, string>;
  extensionSettings!: Table<ExtensionSettings, number>;
  summaries!: Table<Summary, string>;
  investigations!: Table<Investigation, string>;

  constructor() {
    super("AIEscalationCompanionDB");

    this.version(1).stores({
      localSettings: "url, type",
      extensionSettings: "id",
      summaries: "url",
      investigations: "url, sessionId",
    });

    // Version 2: Add toolUsage array to investigations
    this.version(2).stores({
      localSettings: "url, type",
      extensionSettings: "id",
      summaries: "url",
      investigations: "url, sessionId",
    });
  }
}

// Export a singleton instance
export const db = new AppDatabase();
