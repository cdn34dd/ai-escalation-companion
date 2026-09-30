export interface PageExtractor {
  type: string;
  pageContent: string | null;
  expandPageContent: () => void;
  extractPageContent: () => string | null;
}
