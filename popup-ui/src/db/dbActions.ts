import { localSettingsDb } from "./localSettings";
import { extensionSettingsDb } from "./extensionSettings";
import { summariesDb } from "./summaries";
import { investigationsDb } from "./investigations";

// Collection names
export type DBCollection =
  | "localSettings"
  | "extensionSettings"
  | "summaries"
  | "investigations";

// Method names for each collection
export type DBMethod =
  | "get"
  | "getAll"
  | "upsert"
  | "update"
  | "delete"
  | "clear"
  | "exists"
  | "addPath"
  | "removePath"
  | "getPaths"
  | "setPaths"
  | "clearPaths"
  | "getBySessionId"
  | "initialize";

// Database action request
export interface DBActionRequest {
  collection: DBCollection;
  method: DBMethod;
  args?: unknown[]; // Arguments to pass to the method
}

// Database action response
export interface DBActionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Execute a database action
 * This function should only be called from the background script
 */
export async function executeDBAction(
  request: DBActionRequest
): Promise<DBActionResponse> {
  try {
    const { collection, method, args = [] } = request;

    let result: unknown;

    switch (collection) {
      case "localSettings":
        result = await executeMethod(localSettingsDb, method, args);
        break;
      case "extensionSettings":
        result = await executeMethod(extensionSettingsDb, method, args);
        break;
      case "summaries":
        result = await executeMethod(summariesDb, method, args);
        break;
      case "investigations":
        result = await executeMethod(investigationsDb, method, args);
        break;
      default:
        throw new Error(`Unknown collection: ${collection}`);
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("DB Action Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Helper function to execute a method on a database object
 */
async function executeMethod(
  dbObject: object,
  method: DBMethod,
  args: unknown[]
): Promise<unknown> {
  const fn = (dbObject as Record<string, unknown>)[method];
  if (!Object.hasOwn(dbObject, method) || typeof fn !== "function") {
    throw new Error(`Method ${method} does not exist on database object`);
  }

  return await (fn as (...args: unknown[]) => unknown).apply(dbObject, args);
}
