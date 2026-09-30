import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/rendering/markdown';
import { GithubExtractor } from '../src/processing/extractor/GithubExtractor';
import { JiraExtractor } from '../src/processing/extractor/JiraExtractor';
import { getPageType } from '../src/processing/extractor/utils';
import { PageExtractors } from '../src/processing/extractor/types';

describe('safe Markdown rendering', () => {
  it('removes executable and network-loading HTML while retaining code and tables', () => {
    const html = renderMarkdown('<img src="https://example.com/track" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">click</a>\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```ts\nconst value = 1;\n```');
    expect(html).not.toMatch(/<script|<img|onerror|javascript:/);
    expect(html).toContain('<table>'); expect(html).toContain('language-ts'); expect(html).toContain('token');
  });
  it('escapes unknown code languages without interpreting their content as HTML', () => {
    expect(renderMarkdown('```unknown\n<img src=x onerror=alert(1)>\n```')).toContain('&lt;img');
  });
});
describe('page extraction', () => {
  it('supports organizations beyond DataDog and rejects misleading hostnames', () => {
    expect(getPageType('https://github.com/another/repo/issues/12')).toBe(PageExtractors.GITHUB);
    expect(getPageType('https://another.atlassian.net/browse/ABC-12')).toBe(PageExtractors.JIRA);
    expect(getPageType('https://github.com.evil.test/DataDog/repo/issues/12')).toBe(PageExtractors.UNKNOWN);
    expect(getPageType('invalid')).toBe(PageExtractors.UNKNOWN);
  });
  it('extracts GitHub content and comments once and reads updated DOM content', () => {
    document.body.innerHTML = '<h1>Title</h1><div id="issue-body-viewer"><div class="markdown-body">Body</div></div><div class="comment-body">Comment</div>';
    const extractor = new GithubExtractor('https://github.com/org/repo/issues/1');
    expect(extractor.extractPageContent()).toBe('Title\n\nBody\n\nComment');
    document.querySelector('#issue-body-viewer')!.textContent = 'Updated';
    expect(extractor.extractPageContent()).toBe('Title\n\nUpdated\n\nComment');
  });
  it('does not duplicate Jira activity nested inside the ticket body', () => {
    document.body.innerHTML = '<h1>Ticket</h1><div id="issue-content">Description<div aria-label="Activity section">Activity</div></div>';
    expect(new JiraExtractor('https://jira/browse/ABC-1').extractPageContent()).toBe('Ticket\n\nDescriptionActivity');
  });
});
