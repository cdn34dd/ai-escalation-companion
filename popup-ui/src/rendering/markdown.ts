import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';

marked.use(markedHighlight({
  langPrefix: 'language-',
  highlight(code, lang) {
    const aliases: Record<string, string> = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', sh: 'bash' };
    const language = aliases[lang] || lang;
    return Prism.languages[language] ? Prism.highlight(code, Prism.languages[language], language) : code;
  },
}));
export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text, { async: false, breaks: true, gfm: true }), {
    USE_PROFILES: { html: true }, FORBID_TAGS: ['img', 'form', 'input', 'button', 'style'], FORBID_ATTR: ['style'],
  });
}
