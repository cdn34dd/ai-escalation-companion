import type { PageExtractor } from "./PageExtractor";
import { PageExtractors } from "./types";

interface GithubIssueData {
  url: string;
  key: string | null;
  title: string | null;
  status: string | null;
  assignee: string | null;
  description: string | null;
  type: string | null;
  priority: string | null;
  content: string | null;
}

export class GithubExtractor implements PageExtractor {
  type: string;

  pageContent: string | null;

  issueData: GithubIssueData;

  constructor(url: string) {
    this.type = PageExtractors.GITHUB;

    this.pageContent = null;

    this.issueData = {
      url,
      key: null,
      title: null,
      status: null,
      assignee: null,
      description: null,
      type: null,
      priority: null,
      content: null,
    };
  }

  async expandPageContent() {
    //TODO
  }

  extractPageContent() {
    this.handleExtraction();

    console.log("*** Extracting github data ***");
    return this.pageContent;
  }

  private handleExtraction() {
    const title = document.querySelector('[data-testid="issue-title"], .js-issue-title, h1')?.textContent?.trim();
    const bodies = Array.from(document.querySelectorAll('[id="issue-body-viewer"], [data-testid="issue-body"], .comment-body, .markdown-body'));
    const topLevel = bodies.filter((element) => !bodies.some((parent) => parent !== element && parent.contains(element)));
    const content = topLevel.map((element) => element.textContent?.trim()).filter(Boolean).join("\n\n");
    this.pageContent = [title, content].filter(Boolean).join("\n\n") || null;
  }
}
