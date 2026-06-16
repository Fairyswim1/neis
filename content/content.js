(function () {
  'use strict';

  let isRunning = false;
  let shouldStop = false;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({
        ok: true,
        frame: window.location.href,
        hasFocus: isInputElement(document.activeElement),
      });
      return;
    }

    if (message.type === 'START_INPUT' || message.type === 'INPUT_ONE_ROW') {
      if (!isInputElement(document.activeElement)) {
        return;
      }
    }

    if (message.type === 'START_INPUT') {
      if (isRunning) {
        sendResponse({ ok: false, error: '이미 입력이 진행 중입니다.' });
        return;
      }
      runInput(message.config)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    if (message.type === 'STOP_INPUT') {
      shouldStop = true;
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'INPUT_ONE_ROW') {
      if (isRunning) {
        sendResponse({ ok: false, error: '이미 입력이 진행 중입니다.' });
        return;
      }
      runInput({ ...message.config, mode: 'one' })
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }
  });

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getActiveElement() {
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) {
      return active;
    }
    return null;
  }

  function isInputElement(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function setElementValue(el, value) {
    const text = value == null ? '' : String(value);

    if (el.isContentEditable) {
      el.focus();
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    const tag = el.tagName;
    const proto =
      tag === 'TEXTAREA'
        ? HTMLTextAreaElement.prototype
        : tag === 'INPUT'
          ? HTMLInputElement.prototype
          : null;

    if (proto) {
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    el.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  }

  function getFocusableElements() {
    const selector =
      'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]';
    return Array.from(document.querySelectorAll(selector)).filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  function focusNextField() {
    const focusable = getFocusableElements();
    const current = document.activeElement;
    const idx = focusable.indexOf(current);
    if (idx >= 0 && idx < focusable.length - 1) {
      focusable[idx + 1].focus();
      return true;
    }

    const target = document.activeElement || document.body;
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        keyCode: 9,
        which: 9,
        bubbles: true,
        cancelable: true,
      })
    );
    target.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: 'Tab',
        code: 'Tab',
        keyCode: 9,
        which: 9,
        bubbles: true,
        cancelable: true,
      })
    );
    return false;
  }

  function dispatchTab(count) {
    for (let i = 0; i < count; i++) {
      focusNextField();
    }
  }

  async function runInput(config) {
    isRunning = true;
    shouldStop = false;

    const {
      rows,
      startRow = 0,
      tabsBetweenCells = 1,
      tabsAfterRow = 0,
      delayMs = 150,
      mode = 'all',
      skipEmptyRows = true,
    } = config;

    if (!rows || rows.length === 0) {
      isRunning = false;
      throw new Error('입력할 데이터가 없습니다.');
    }

    let activeEl = getActiveElement();
    if (!isInputElement(activeEl)) {
      isRunning = false;
      throw new Error('나이스 입력칸을 먼저 클릭한 후 다시 시도해 주세요.');
    }

    let currentRowIndex = startRow;
    let processedRows = 0;

    const endRow = mode === 'one' ? startRow + 1 : rows.length;

    try {
      for (let r = startRow; r < endRow; r++) {
        if (shouldStop) break;

        const row = rows[r];
        if (!row) continue;

        const cells = row.filter((cell) => cell !== undefined);
        if (skipEmptyRows && cells.every((c) => c === '' || c == null)) {
          currentRowIndex = r + 1;
          continue;
        }

        for (let c = 0; c < row.length; c++) {
          if (shouldStop) break;

          const value = row[c];
          if (value === undefined) continue;

          activeEl = getActiveElement();
          if (!isInputElement(activeEl)) {
            throw new Error(`${r + 1}행 ${c + 1}열: 입력칸을 찾을 수 없습니다.`);
          }

          setElementValue(activeEl, value);
          await sleep(delayMs);

          const isLastCell = c === row.length - 1;
          const tabCount = isLastCell ? tabsAfterRow : tabsBetweenCells;
          if (tabCount > 0) {
            dispatchTab(tabCount);
            await sleep(delayMs);
          }
        }

        processedRows++;
        currentRowIndex = r + 1;

        if (mode === 'one') break;
      }
    } finally {
      isRunning = false;
    }

    return {
      processedRows,
      nextRowIndex: currentRowIndex,
      stopped: shouldStop,
    };
  }
})();
