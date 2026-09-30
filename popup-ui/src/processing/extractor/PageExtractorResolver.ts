import { GithubExtractor } from "./GithubExtractor";
import { JiraExtractor } from "./JiraExtractor";
import { PageExtractors } from "./types";

export class PageExtractorResolver {
  static create(pageType: PageExtractors, url: string) {
    switch (pageType) {
      case PageExtractors.JIRA: {
        return new JiraExtractor(url);
      }

      case PageExtractors.GITHUB: {
        return new GithubExtractor(url);
      }
    }
  }
}
