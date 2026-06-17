chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    menuPreset: 'segmok',
    tabsBetweenCells: 1,
    tabsAfterRow: 2,
    rowEndType: 'tab',
    delayMs: 100,
    inputStatus: '',
  });
  setupSidePanel();
});

function setupSidePanel() {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
}

chrome.runtime.onStartup.addListener(setupSidePanel);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findFocusedFrame(tabId) {
  const frames = await chrome.webNavigation.getAllFrames({ tabId });
  for (const frame of frames) {
    try {
      const response = await chrome.tabs.sendMessage(
        tabId,
        { type: 'PING' },
        { frameId: frame.frameId }
      );
      if (response?.hasFocus) {
        return frame.frameId;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function waitForFocusedFrame(tabId, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const frameId = await findFocusedFrame(tabId);
    if (frameId != null) return frameId;
    await sleep(200);
  }
  return null;
}

async function setInputStatus(msg, type = '') {
  await chrome.storage.local.set({ inputStatus: msg, inputStatusType: type });
  try {
    await chrome.action.setBadgeText({ text: type === 'error' ? '!' : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  } catch {
    // ignore
  }
}

async function runInputJob({ tabId, config, mode }) {
  await setInputStatus('5초 안에 나이스 첫 입력칸을 클릭하세요!', '');

  let frameId = null;
  for (let sec = 5; sec >= 1; sec--) {
    await setInputStatus(`${sec}초 안에 나이스 첫 입력칸을 클릭하세요!`);
    frameId = await waitForFocusedFrame(tabId, 1000);
    if (frameId != null) break;
  }

  if (frameId == null) {
    await setInputStatus('입력칸을 찾지 못했습니다. 입력칸 클릭 후 다시 시도해 주세요.', 'error');
    return { ok: false, error: '입력칸 없음' };
  }

  await setInputStatus(mode === 'all' ? '전체 입력 중...' : '한 행 입력 중...');

  const messageType = mode === 'one' ? 'INPUT_ONE_ROW' : 'START_INPUT';
  try {
    const response = await chrome.tabs.sendMessage(
      tabId,
      { type: messageType, config },
      { frameId }
    );

    if (!response?.ok) {
      await setInputStatus(response?.error || '입력 실패', 'error');
      return response;
    }

    if (mode === 'one') {
      await setInputStatus(`${response.processedRows}행 입력 완료`, 'success');
    } else if (response.stopped) {
      await setInputStatus(`중지됨. ${response.processedRows}행까지 입력`, 'success');
    } else {
      await setInputStatus(`전체 ${response.processedRows}행 입력 완료`, 'success');
    }

    await chrome.action.setBadgeText({ text: '' });
    return { ok: true, ...response };
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('Receiving end does not exist')) {
      await setInputStatus('나이스 페이지를 새로고침(F5) 후 다시 시도해 주세요.', 'error');
    } else {
      await setInputStatus(msg, 'error');
    }
    return { ok: false, error: msg };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RUN_INPUT') {
    runInputJob(message)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'STOP_INPUT') {
    const tabId = message.tabId;
    chrome.webNavigation.getAllFrames({ tabId }).then((frames) => {
      frames.forEach((frame) => {
        chrome.tabs.sendMessage(tabId, { type: 'STOP_INPUT' }, { frameId: frame.frameId }).catch(() => {});
      });
    });
    setInputStatus('중지 요청됨...');
    sendResponse({ ok: true });
    return;
  }
});
