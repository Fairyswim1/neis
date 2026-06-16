chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    tabsBetweenCells: 1,
    tabsAfterRow: 0,
    delayMs: 150,
    inputMode: 'all',
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] || null });
    });
    return true;
  }

  if (message.type === 'PING_CONTENT') {
    const tabId = message.tabId;
    chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse(response);
      }
    });
    return true;
  }
});
