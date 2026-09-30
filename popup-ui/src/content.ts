import { MessageRecipients, MessageTypes, type Message } from './actions/types';
import { PageExtractorResolver } from './processing/extractor/PageExtractorResolver';
import { getPageType } from './processing/extractor/utils';

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type !== MessageTypes.EXTRACTION_START || message.recipient !== MessageRecipients.CONTENT_SCRIPT) return false;
  const url = window.location.href;
  const extractor = PageExtractorResolver.create(getPageType(url), url);
  sendResponse({ type: extractor ? MessageTypes.EXTRACTION_COMPLETE : MessageTypes.INVALID_PAGE,
    recipient: MessageRecipients.POPUP, url, data: extractor?.extractPageContent() || '' });
  return false;
});
// Jira and GitHub navigate and render content without a full page reload.
let timer: ReturnType<typeof setTimeout>;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    void chrome.runtime.sendMessage({ type: MessageTypes.PAGE_CONTENT_CHANGED, recipient: MessageRecipients.POPUP, url: location.href }).catch(() => {});
  }, 750);
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
