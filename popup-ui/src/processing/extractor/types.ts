export const PageExtractors = {
  JIRA: "JIRA",
  GITHUB: "GITHUB",
  ZENDESK: "ZENDESK",
  UNKNOWN: "UNKNOWN",
} as const;
export type PageExtractors = (typeof PageExtractors)[keyof typeof PageExtractors];
