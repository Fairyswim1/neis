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

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.offsetParent === null && style.position !== 'fixed') return false;
    return true;
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
    if (el.getAttribute('role') === 'textbox') return true;
    return false;
  }

  function delayAfterValue(value, baseDelay) {
    const len = String(value ?? '').length;
    if (len <= 80) return baseDelay;
    if (len <= 300) return Math.max(baseDelay, 450);
    return Math.max(baseDelay, 700 + Math.min(Math.floor(len / 6), 1500));
  }

  async function settleAfterInput(el, value, delayMs) {
    const len = String(value ?? '').length;
    await sleep(delayAfterValue(value, delayMs));
    if (len > 80 && el) {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      await sleep(len > 300 ? 450 : 280);
    }
  }

  function setElementValue(el, value) {
    const text = value == null ? '' : String(value);
    el.focus();

    if (el.isContentEditable) {
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

    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  }

  function getTabIndex(el) {
    const raw = el.getAttribute('tabindex');
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  /** 브라우저 Tab 순서와 비슷하게 — 버튼·숨김 tabindex 포함 */
  function getTabbableElements() {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      '[role="textbox"]',
    ].join(', ');

    const elements = Array.from(document.querySelectorAll(selector)).filter(isVisible);

    const positive = elements
      .filter((el) => getTabIndex(el) > 0)
      .sort((a, b) => getTabIndex(a) - getTabIndex(b) || sortByDocumentOrder(a, b));

    const zero = elements
      .filter((el) => getTabIndex(el) <= 0)
      .sort(sortByDocumentOrder);

    return [...positive, ...zero];
  }

  function sortByDocumentOrder(a, b) {
    if (a === b) return 0;
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  }

  function dispatchKeyOn(target, key, code, keyCode) {
    for (const type of ['keydown', 'keypress', 'keyup']) {
      target.dispatchEvent(
        new KeyboardEvent(type, {
          key,
          code,
          keyCode,
          which: keyCode,
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );
    }
  }

  function findTabStopIndex(tabbable, el) {
    let idx = tabbable.indexOf(el);
    if (idx >= 0) return idx;
    return tabbable.findIndex((node) => node === el || node.contains(el) || el.contains(node));
  }

  const MIN_STEP_MS = 110;
  const TEXT_ROW_STEP_MS = 160;

  function getInputRect(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, top: r.top, width: r.width };
  }

  function isWritableScoreInput(el) {
    if (!el || !isInputElement(el)) return false;
    if (el.tagName === 'SELECT') return false;
    const type = (el.type || '').toLowerCase();
    if (type === 'checkbox' || type === 'hidden' || type === 'button' || type === 'submit') {
      return false;
    }
    return !el.disabled && !el.readOnly;
  }

  /** 지필평가 전용: Tab N번 후 같은 열 아래 행인지 확인, 아니면 추가 Tab */
  async function moveToNextRowScoreTab(fromEl, config) {
    const { tabsAfterRow = 6, delayMs = 100 } = config;
    const stepDelay = Math.max(delayMs, MIN_STEP_MS);
    const start = getInputRect(fromEl);
    const xTol = Math.max(start.width * 0.75, 50);
    const hadValue = String(fromEl.value ?? fromEl.textContent ?? '') !== '';

    function isNextRowInput(now) {
      if (!isWritableScoreInput(now)) return false;
      const pos = getInputRect(now);
      const yDiff = pos.top - start.top;
      const xDiff = Math.abs(pos.x - start.x);
      if (xDiff > xTol) return false;
      if (yDiff > 8) return true;
      if (now === fromEl && hadValue && String(now.value ?? now.textContent ?? '') === '') {
        return true;
      }
      return false;
    }

    fromEl.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(80);

    await advanceTabStops(tabsAfterRow, stepDelay);
    if (isNextRowInput(getActiveElement())) return;

    for (let i = 0; i < 18; i++) {
      await advanceTabStops(1, stepDelay);
      if (isNextRowInput(getActiveElement())) return;
    }
  }

  async function advanceTabStops(count, delayMs) {
    const stepDelay = Math.max(delayMs, MIN_STEP_MS);

    for (let i = 0; i < count; i++) {
      const before = document.activeElement;

      const target = isInputElement(before) ? before : document.body;
      dispatchKeyOn(target, 'Tab', 'Tab', 9);

      await sleep(stepDelay);

      if (document.activeElement === before) {
        const tabbable = getTabbableElements();
        const idx = findTabStopIndex(tabbable, before);
        if (idx >= 0 && idx < tabbable.length - 1) {
          tabbable[idx + 1].focus();
          await sleep(60);
        }
      }
    }
  }

  function pressEnter() {
    const target =
      isInputElement(document.activeElement) ? document.activeElement : document.body;
    dispatchKeyOn(target, 'Enter', 'Enter', 13);
  }

  function findWritableInput() {
    const active = getActiveElement();
    if (isInputElement(active)) return active;

    const tabbable = getTabbableElements();
    for (const el of tabbable) {
      if (isInputElement(el)) return el;
    }

    const textarea = document.querySelector('textarea:not([disabled])');
    if (textarea && isVisible(textarea)) {
      textarea.focus();
      return textarea;
    }

    return null;
  }

  async function moveToNextCell(tabsBetweenCells, delayMs) {
    if (tabsBetweenCells <= 0) return;
    await advanceTabStops(tabsBetweenCells, delayMs);
  }

  async function moveToNextRow(config, rowIndex, totalRows) {
    const { tabsAfterRow = 0, rowEndType = 'enter', rowNav = 'default', delayMs = 100 } = config;
    if (rowIndex >= totalRows - 1) return;

    if (rowNav === 'score-tab') {
      const active = getActiveElement();
      if (active) {
        await moveToNextRowScoreTab(active, config);
      }
      await sleep(Math.max(delayMs, MIN_STEP_MS));
      return;
    }

    const tabStep = Math.max(delayMs, TEXT_ROW_STEP_MS);
    const rowDelay = tabStep;
    const active = getActiveElement();

    if (active) {
      active.dispatchEvent(new Event('blur', { bubbles: true }));
      await sleep(80);
    }

    if (rowEndType === 'enter') {
      pressEnter();
      await sleep(rowDelay);
    } else if (rowEndType === 'tab') {
      if (tabsAfterRow > 0) {
        await advanceTabStops(tabsAfterRow, tabStep);
      }
    } else if (rowEndType === 'enter-then-tab') {
      pressEnter();
      await sleep(rowDelay);
      if (tabsAfterRow > 0) {
        await advanceTabStops(tabsAfterRow, tabStep);
      }
    }

    await sleep(rowDelay);
    if (!isInputElement(getActiveElement())) {
      const el = findWritableInput();
      if (el) el.focus();
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
      rowEndType = 'enter',
      delayMs = 100,
      mode = 'all',
      skipEmptyRows = true,
    } = config;

    if (!rows || rows.length === 0) {
      isRunning = false;
      throw new Error('입력할 데이터가 없습니다.');
    }

    if (!isInputElement(getActiveElement())) {
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
          if (value === undefined || value === '') continue;

          let activeEl = findWritableInput();
          if (!activeEl) {
            const moveHint =
              rowEndType === 'enter'
                ? 'Enter 방식'
                : `Tab ${tabsAfterRow}번 방식`;
            throw new Error(
              `${r + 1}행 ${c + 1}열: 입력칸을 찾을 수 없습니다. (${moveHint})`
            );
          }

          setElementValue(activeEl, value);
          await settleAfterInput(activeEl, value, delayMs);

          const isLastCell = c === row.length - 1;
          if (!isLastCell) {
            await moveToNextCell(tabsBetweenCells, delayMs);
          } else if (mode !== 'one') {
            await moveToNextRow(config, r, rows.length);
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
