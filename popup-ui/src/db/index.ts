// Export database instance and types
export { db, AppDatabase } from "./schema";
export type {
  LocalSettings,
  ExtensionSettings,
  Summary,
  Investigation,
  ToolUsageEntry,
} from "./schema";

// Export all database utilities (for background script use only)
export { localSettingsDb } from "./localSettings";
export { extensionSettingsDb } from "./extensionSettings";
export { summariesDb } from "./summaries";
export { investigationsDb } from "./investigations";

// Export database actions (for background script use only)
export { executeDBAction } from "./dbActions";
export type { DBActionRequest, DBActionResponse, DBCollection, DBMethod } from "./dbActions";

// Export database client (for popup use)
export { DBClient } from "./dbClient";

