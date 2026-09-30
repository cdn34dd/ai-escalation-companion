import { MessageTypes, MessageRecipients } from "../actions/types";
import type { DBActionRequest, DBActionResponse } from "./dbActions";
import type { LocalSettings, ExtensionSettings, Summary, Investigation } from "./schema";

export class DBClient {
  private static async execute<T>(request: DBActionRequest): Promise<T> {
    const response: DBActionResponse | undefined = await chrome.runtime.sendMessage({
      type: MessageTypes.DB_ACTION_START, recipient: MessageRecipients.SERVICE_WORKER, data: request,
    });
    if (!response?.success) throw new Error(response?.error || "Database action failed");
    return response.data as T;
  }

  static localSettings = {
    setPaths: (url: string, paths: string[]) => DBClient.execute<void>({ collection: "localSettings", method: "setPaths", args: [url, paths] }),
    get: (url: string) => DBClient.execute<LocalSettings | undefined>({ collection: "localSettings", method: "get", args: [url] }),
    upsert: (settings: LocalSettings) => DBClient.execute<string>({ collection: "localSettings", method: "upsert", args: [settings] }),
    update: (url: string, updates: Partial<Omit<LocalSettings, "url">>) => DBClient.execute<number>({ collection: "localSettings", method: "update", args: [url, updates] }),
    addPath: (url: string, path: string) => DBClient.execute<void>({ collection: "localSettings", method: "addPath", args: [url, path] }),
    removePath: (url: string, path: string) => DBClient.execute<void>({ collection: "localSettings", method: "removePath", args: [url, path] }),
    getAll: () => DBClient.execute<LocalSettings[]>({ collection: "localSettings", method: "getAll", args: [] }),
    delete: (url: string) => DBClient.execute<void>({ collection: "localSettings", method: "delete", args: [url] }),
    clear: () => DBClient.execute<void>({ collection: "localSettings", method: "clear", args: [] }),
  };

  static extensionSettings = {
    get: () => DBClient.execute<ExtensionSettings | undefined>({ collection: "extensionSettings", method: "get", args: [] }),
    upsert: (settings: Omit<ExtensionSettings, "id">) => DBClient.execute<number>({ collection: "extensionSettings", method: "upsert", args: [settings] }),
    update: (updates: Partial<Omit<ExtensionSettings, "id">>) => DBClient.execute<number>({ collection: "extensionSettings", method: "update", args: [updates] }),
    getPaths: () => DBClient.execute<string[]>({ collection: "extensionSettings", method: "getPaths", args: [] }),
    setPaths: (paths: string[]) => DBClient.execute<void>({ collection: "extensionSettings", method: "setPaths", args: [paths] }),
    addPath: (path: string) => DBClient.execute<void>({ collection: "extensionSettings", method: "addPath", args: [path] }),
    removePath: (path: string) => DBClient.execute<void>({ collection: "extensionSettings", method: "removePath", args: [path] }),
    clearPaths: () => DBClient.execute<void>({ collection: "extensionSettings", method: "clearPaths", args: [] }),
  };

  static summaries = {
    get: (url: string) => DBClient.execute<Summary | undefined>({ collection: "summaries", method: "get", args: [url] }),
    upsert: (summary: Summary) => DBClient.execute<string>({ collection: "summaries", method: "upsert", args: [summary] }),
    update: (url: string, data: string) => DBClient.execute<number>({ collection: "summaries", method: "update", args: [url, data] }),
    getAll: () => DBClient.execute<Summary[]>({ collection: "summaries", method: "getAll", args: [] }),
    delete: (url: string) => DBClient.execute<void>({ collection: "summaries", method: "delete", args: [url] }),
    clear: () => DBClient.execute<void>({ collection: "summaries", method: "clear", args: [] }),
    exists: (url: string) => DBClient.execute<boolean>({ collection: "summaries", method: "exists", args: [url] }),
  };

  static investigations = {
    get: (url: string) => DBClient.execute<Investigation | undefined>({ collection: "investigations", method: "get", args: [url] }),
    upsert: (investigation: Investigation) => DBClient.execute<string>({ collection: "investigations", method: "upsert", args: [investigation] }),
    update: (url: string, updates: Partial<Omit<Investigation, "url">>) => DBClient.execute<number>({ collection: "investigations", method: "update", args: [url, updates] }),
    getAll: () => DBClient.execute<Investigation[]>({ collection: "investigations", method: "getAll", args: [] }),
    getBySessionId: (sessionId: string) => DBClient.execute<Investigation[]>({ collection: "investigations", method: "getBySessionId", args: [sessionId] }),
    delete: (url: string) => DBClient.execute<void>({ collection: "investigations", method: "delete", args: [url] }),
    clear: () => DBClient.execute<void>({ collection: "investigations", method: "clear", args: [] }),
    exists: (url: string) => DBClient.execute<boolean>({ collection: "investigations", method: "exists", args: [url] }),
  };
}
