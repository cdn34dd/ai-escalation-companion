import { PageExtractors } from './types';
export function getPageType(value: string): PageExtractors {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return PageExtractors.UNKNOWN;
    if (url.hostname === 'github.com' && /^\/[^/]+\/[^/]+\/(issues|pull)\/\d+/.test(url.pathname)) return PageExtractors.GITHUB;
    if (url.hostname.endsWith('.atlassian.net') || /\/(?:jira\/|browse\/)/.test(url.pathname)) return PageExtractors.JIRA;
    return PageExtractors.UNKNOWN;
  } catch { return PageExtractors.UNKNOWN; }
}
