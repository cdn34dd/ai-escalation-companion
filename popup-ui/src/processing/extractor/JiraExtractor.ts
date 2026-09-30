import type { PageExtractor } from "./PageExtractor";
import { PageExtractors } from "./types";

interface JiraTicketData {
  url: string;
  ticketKey: string | null;
  title: string | null;
  status: string | null;
  assignee: string | null;
  description: string | null;
  type: string | null;
  priority: string | null;
  content: string | null;
}

export class JiraExtractor implements PageExtractor {
  type: string;

  pageContent: string | null;

  ticketData: JiraTicketData;

  constructor(url: string) {
    this.type = PageExtractors.JIRA;

    this.pageContent = null;

    this.ticketData = {
      url,
      ticketKey: null,
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
    const maxIterations = 10;
    let iteration = 0;

    while (iteration < maxIterations) {
      const buttons = Array.from(document.querySelectorAll("button"));
      const showMoreButton = buttons.find((btn) => {
        const text = btn.textContent?.toLowerCase() || "";
        return text.includes("show more comments");
      });

      if (!showMoreButton) {
        console.log("No more 'show more' buttons found");
        break;
      }

      console.log("Clicking show more button:", showMoreButton.textContent);
      showMoreButton.click();

      await new Promise((resolve) => setTimeout(resolve, 500));
      iteration++;
    }

    console.log(`Expanded content after ${iteration} iterations`);
  }

  extractPageContent() {
    this.handleExtraction();

    return this.pageContent;
  }

  private handleExtraction() {
    const title = document.querySelector("h1, #summary-val")?.textContent?.trim();
    const root = document.querySelector('[data-testid="issue.views.issue-details.issue-layout.container-left"], #issue-content, #description-val');
    const content = root?.textContent?.trim();
    const activity = document.querySelector('[aria-label="Activity section"], #issue-activity-stream');
    const comments = activity && !root?.contains(activity) ? activity.textContent?.trim() : null;
    this.pageContent = [title, content, comments].filter(Boolean).join("\n\n") || null;
  }
}
