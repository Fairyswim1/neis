(function () {
  'use strict';

  const LISTENER_KEY = '__NEIS_COPY_FAIRY_LISTENER__';
  if (globalThis[LISTENER_KEY]) {
    try {
      chrome.runtime.onMessage.removeListener(globalThis[LISTENER_KEY]);
    } catch {
      // ignore
    }
  }

  let isRunning = false;
  let shouldStop = false;

  function onExtensionMessage(message, _sender, sendResponse) {
    if (message.type === 'PING') {
      sendResponse({
        ok: true,
        frame: window.location.href,
        hasFocus: hasFocusedInput(),
      });
      return;
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
  }

  globalThis[LISTENER_KEY] = onExtensionMessage;
  chrome.runtime.onMessage.addListener(onExtensionMessage);

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number(style.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
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

  function isWritableInput(el) {
    if (!el || !isInputElement(el)) return false;
    if (el.tagName === 'SELECT') return false;
    const type = (el.type || '').toLowerCase();
    if (type === 'checkbox' || type === 'hidden' || type === 'button' || type === 'submit') {
      return false;
    }
    if (el.disabled || !isVisible(el)) return false;
    if (el.readOnly && el !== document.activeElement) return false;
    return true;
  }

  /** 클릭한 셀(td/div) 안의 input까지 포커스를 찾음 — 지필평가 그리드용 */
  function resolveFocusedInput() {
    const focused = document.querySelector(
      'input:focus:not([type="hidden"]), textarea:focus, [contenteditable="true"]:focus, [role="textbox"]:focus'
    );
    if (focused && isWritableInput(focused)) return focused;

    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) {
      return null;
    }

    if (isWritableInput(active)) return active;

    const cellSelector = 'td, th, [role="gridcell"], [role="cell"]';
    let node = active;
    for (let depth = 0; depth < 6 && node; depth++) {
      if (node.matches?.(cellSelector)) {
        const inner = node.querySelector(
          'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [contenteditable="true"], [role="textbox"]'
        );
        if (inner && isVisible(inner)) {
          inner.focus();
          if (isWritableInput(inner) || isInputElement(inner)) return inner;
        }
      }
      node = node.parentElement;
    }

    return null;
  }

  function hasFocusedInput() {
    return !!resolveFocusedInput();
  }

  function delayAfterValue(value, baseDelay) {
    const len = String(value ?? '').length;
    if (len <= 80) return baseDelay;
    if (len <= 300) return Math.max(baseDelay, 450);
    return Math.max(baseDelay, 700 + Math.min(Math.floor(len / 6), 1500));
  }

  /** 지필 점수 전용 대기 (세특·다른 메뉴와 분리) */
  const SCORE_MIN_SETTLE_MS = 80;
  const SCORE_POST_CHANGE_MS = 35;

  function scoreSettleDelay(value, baseDelay) {
    const text = String(value ?? '').trim();
    let ms = Math.max(baseDelay, SCORE_MIN_SETTLE_MS);
    if (text.length >= 3) ms += 25;
    const n = parseFloat(text);
    if (!Number.isNaN(n) && n >= 99) ms += 35;
    return ms;
  }

  async function settleAfterInput(el, value, delayMs, options = {}) {
    const len = String(value ?? '').length;
    const waitMs = options.scoreTab ? scoreSettleDelay(value, delayMs) : delayAfterValue(value, delayMs);
    await sleep(waitMs);
    if (options.scoreTab && el) {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (options.commitBlur !== false) {
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      await sleep(SCORE_POST_CHANGE_MS);
      return;
    }
    if (len > 80 && el) {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      await sleep(len > 300 ? 450 : 280);
    }
  }

  function normalizeScoreText(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'number') {
      if (Number.isFinite(value) && Math.abs(value - Math.round(value)) < 1e-6) {
        return String(Math.round(value));
      }
      const rounded = Math.round(value * 100) / 100;
      return String(rounded);
    }
    const text = String(value).trim();
    const n = parseFloat(text.replace(/,/g, ''));
    if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(text.replace(/,/g, ''))) {
      if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
      return String(Math.round(n * 100) / 100);
    }
    return text;
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
    if (!isWritableInput(el)) return false;
    if (el.readOnly) return false;
    return true;
  }

  function columnToleranceFor(rect) {
    return Math.max(rect.width * 0.45, 20);
  }

  function findScrollableAncestor(el) {
    let node = el?.parentElement;
    while (node && node !== document.documentElement) {
      const style = window.getComputedStyle(node);
      const oy = style.overflowY;
      if (
        (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
        node.scrollHeight > node.clientHeight + 4
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function isInScrollParentView(el, scroller, margin = 6) {
    if (!el) return false;
    const er = el.getBoundingClientRect();
    if (er.width === 0 && er.height === 0) return false;
    if (!scroller || scroller === document.scrollingElement || scroller === document.documentElement) {
      return er.top >= margin && er.bottom <= window.innerHeight - margin;
    }
    const sr = scroller.getBoundingClientRect();
    return er.top >= sr.top + margin && er.bottom <= sr.bottom - margin;
  }

  function estimateRowHeight(refEl) {
    const row = findGridAncestor(refEl, GRID_ROW_SEL);
    const h = row?.getBoundingClientRect().height;
    if (h && h > 8) return h;
    return 34;
  }

  async function scrollIntoScrollParent(el, scroller) {
    if (!el) return;
    const target = findGridAncestor(el, GRID_ROW_SEL) || el;

    if (!scroller || scroller === document.scrollingElement || scroller === document.documentElement) {
      try {
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      } catch {
        target.scrollIntoView(false);
      }
      return;
    }

    const tr = target.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    const delta = tr.top - sr.top - (sr.height - tr.height) / 2;
    scroller.scrollTop += delta;
  }

  async function scrollContainerDown(scroller, pixels, waitMs = 45) {
    if (!scroller) return;
    scroller.scrollTop += pixels;
    await sleep(waitMs);
  }

  function pickScoreCandidate(scoreNav, offset, prevEl, lastTop) {
    if (offset === 0) return scoreNav.getInput(0);
    if (prevEl && scoreNav.getNextAfter) {
      const next = scoreNav.getNextAfter(prevEl);
      if (next) return next;
    }
    const byOffset = scoreNav.getInput(offset);
    if (byOffset) return byOffset;
    if (lastTop != null && scoreNav.findBelowY) return scoreNav.findBelowY(lastTop);
    return null;
  }

  const GRID_CELL_SEL = 'td, th, [role="gridcell"], [role="cell"]';
  const GRID_ROW_SEL = 'tr, [role="row"]';

  function findGridAncestor(el, selector) {
    let node = el;
    for (let depth = 0; depth < 12 && node; depth++) {
      if (node.matches?.(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function rowGridCells(row) {
    if (!row) return [];
    const direct = Array.from(row.children).filter((el) => el.matches?.(GRID_CELL_SEL));
    if (direct.length) return direct;
    return Array.from(row.querySelectorAll(GRID_CELL_SEL));
  }

  function cellScoreInput(cell) {
    if (!cell) return null;
    const inner = cell.querySelector(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [contenteditable="true"]'
    );
    if (inner && isWritableScoreInput(inner)) return inner;
    if (isWritableScoreInput(cell)) return cell;
    return null;
  }

  /** 확대/축소와 무관하게 표 열 번호로 서답형 칸 탐색 */
  function createTableScoreNavigator(startEl) {
    const startCell = findGridAncestor(startEl, GRID_CELL_SEL);
    const startRow = findGridAncestor(startEl, GRID_ROW_SEL);
    if (!startCell || !startRow) return null;

    const startCells = rowGridCells(startRow);
    const colIdx = startCells.indexOf(startCell);
    if (colIdx < 0) return null;

    const container =
      findGridAncestor(startRow, 'table, [role="grid"], tbody, thead') || startRow.parentElement;
    if (!container) return null;

    const scrollContainer = findScrollableAncestor(startRow);

    function listDataRows() {
      return Array.from(container.querySelectorAll(GRID_ROW_SEL)).filter((row) => {
        const cells = rowGridCells(row);
        return cells.length > colIdx && !!cellScoreInput(cells[colIdx]);
      });
    }

    function inputAtRow(row) {
      const cells = rowGridCells(row);
      return cellScoreInput(cells[colIdx]);
    }

    const rows = listDataRows();
    let baseIdx = rows.indexOf(startRow);
    if (baseIdx < 0) baseIdx = 0;

    return {
      mode: 'table',
      colIdx,
      baseIdx,
      container,
      scrollContainer,
      listDataRows,
      getInput(offset) {
        const dataRows = listDataRows();
        const idx = baseIdx + offset;
        if (idx < 0 || idx >= dataRows.length) return null;
        return inputAtRow(dataRows[idx]);
      },
      getNextAfter(prevEl) {
        const prevRow = findGridAncestor(prevEl, GRID_ROW_SEL);
        const dataRows = listDataRows();
        const i = dataRows.indexOf(prevRow);
        if (i >= 0 && i + 1 < dataRows.length) {
          return inputAtRow(dataRows[i + 1]);
        }
        return null;
      },
      findBelowY(minTop) {
        let best = null;
        let bestTop = Infinity;
        for (const row of listDataRows()) {
          const input = inputAtRow(row);
          if (!input) continue;
          const top = getInputRect(input).top;
          if (top > minTop + 3 && top < bestTop) {
            bestTop = top;
            best = input;
          }
        }
        return best;
      },
    };
  }

  function createXScoreNavigator(startEl) {
    const anchorRect = getInputRect(startEl);
    const xTol = columnToleranceFor(anchorRect);
    const initial = getScoreColumnInputs(anchorRect, xTol);
    let baseIdx = findScoreColumnIndex(initial, startEl);
    if (baseIdx < 0) baseIdx = 0;
    const scrollContainer = findScrollableAncestor(startEl);

    return {
      mode: 'x',
      anchorRect,
      xTol,
      baseIdx,
      scrollContainer,
      getInput(offset) {
        const inputs = getScoreColumnInputs(anchorRect, xTol);
        const idx = baseIdx + offset;
        return idx >= 0 && idx < inputs.length ? inputs[idx] : null;
      },
      findBelowY(minTop) {
        const inputs = getScoreColumnInputs(anchorRect, xTol);
        let best = null;
        let bestTop = Infinity;
        for (const input of inputs) {
          const top = getInputRect(input).top;
          if (top > minTop + 3 && top < bestTop) {
            bestTop = top;
            best = input;
          }
        }
        return best;
      },
    };
  }

  function createScoreNavigator(startEl) {
    return createTableScoreNavigator(startEl) || createXScoreNavigator(startEl);
  }

  function getScoreColumnInputs(anchorRect, xTol) {
    const selector =
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [contenteditable="true"]';
    const candidates = Array.from(document.querySelectorAll(selector))
      .filter(isWritableScoreInput)
      .filter(isVisible)
      .map((el) => ({ el, rect: getInputRect(el) }))
      .filter(({ rect }) => Math.abs(rect.x - anchorRect.x) <= xTol)
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.x - b.rect.x);

    const deduped = [];
    for (const item of candidates) {
      const last = deduped[deduped.length - 1];
      if (last && Math.abs(item.rect.top - last.rect.top) < 6) continue;
      deduped.push(item);
    }
    return deduped.map((i) => i.el);
  }

  function findScoreColumnIndex(inputs, el) {
    if (!el) return -1;
    let idx = inputs.indexOf(el);
    if (idx >= 0) return idx;
    return inputs.findIndex((node) => node === el || node.contains(el) || el.contains(node));
  }

  async function focusScoreCell(el, scroller) {
    const scrollParent = scroller || findScrollableAncestor(el);
    if (!isInScrollParentView(el, scrollParent)) {
      await scrollIntoScrollParent(el, scrollParent);
      await sleep(28);
    }
    el.focus();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(35);
  }

  async function revealScoreInput(scoreNav, offset, prevEl, lastTop) {
    const scroller = scoreNav.scrollContainer || findScrollableAncestor(prevEl);
    const rowStep = estimateRowHeight(prevEl || document.activeElement);

    let el = pickScoreCandidate(scoreNav, offset, prevEl, lastTop);
    if (el && isInScrollParentView(el, scroller)) {
      await focusScoreCell(el, scroller);
      return el;
    }

    if (el) {
      await scrollIntoScrollParent(el, scroller);
      await sleep(30);
      if (isInScrollParentView(el, scroller)) {
        await focusScoreCell(el, scroller);
        return el;
      }
    }

    for (let attempt = 0; attempt < 22; attempt++) {
      el = pickScoreCandidate(scoreNav, offset, prevEl, lastTop);
      if (el) {
        await scrollIntoScrollParent(el, scroller);
        await sleep(28);
        if (isInScrollParentView(el, scroller)) {
          await focusScoreCell(el, scroller);
          return el;
        }
      }
      await scrollContainerDown(scroller, rowStep);
    }

    return null;
  }

  async function resolveScoreInput(scoreNav, offset, config, prevEl, lastTop) {
    const el = await revealScoreInput(scoreNav, offset, prevEl, lastTop);
    if (el) return el;

    if (offset > 0 && prevEl && config.rowNav === 'score-tab') {
      const anchor = getInputRect(prevEl);
      await moveToNextRowScoreTab(prevEl, config, anchor, columnToleranceFor(anchor));
      await sleep(Math.max(config.delayMs || 100, MIN_STEP_MS));
      const recovered = resolveFocusedInput();
      if (recovered) return recovered;
    }

    return null;
  }

  /** 지필평가 전용: Tab N번 후 같은 열 아래 행인지 확인, 아니면 추가 Tab */
  async function moveToNextRowScoreTab(fromEl, config, anchorRect, xTol) {
    const { tabsAfterRow = 6, delayMs = 100 } = config;
    const stepDelay = Math.max(delayMs, MIN_STEP_MS);
    const start = anchorRect || getInputRect(fromEl);
    const tol = xTol ?? columnToleranceFor(start);
    const hadValue = String(fromEl.value ?? fromEl.textContent ?? '') !== '';
    let target = null;

    function captureNextRow(now) {
      if (!isWritableScoreInput(now)) return false;
      const pos = getInputRect(now);
      const yDiff = pos.top - start.top;
      const xDiff = Math.abs(pos.x - start.x);
      if (xDiff > tol) return false;
      if (yDiff > 8) {
        target = now;
        return true;
      }
      if (now === fromEl && hadValue && String(now.value ?? now.textContent ?? '') === '') {
        target = now;
        return true;
      }
      return false;
    }

    fromEl.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(80);

    await advanceTabStops(tabsAfterRow, stepDelay);
    if (captureNextRow(resolveFocusedInput() || getActiveElement())) {
      target?.focus();
      await sleep(60);
      return;
    }

    for (let i = 0; i < 18; i++) {
      await advanceTabStops(1, stepDelay);
      if (captureNextRow(resolveFocusedInput() || getActiveElement())) {
        target?.focus();
        await sleep(60);
        return;
      }
    }

    const recovered = resolveFocusedInput();
    if (recovered) {
      recovered.focus();
      await sleep(60);
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

  function findWritableInput(config = {}) {
    const resolved = resolveFocusedInput();
    if (resolved) return resolved;

    const isScore = config.rowNav === 'score-tab';
    if (isScore) return null;

    const tabbable = getTabbableElements();
    for (const el of tabbable) {
      if (isWritableInput(el)) return el;
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
        const anchor = getInputRect(active);
        const xTol = columnToleranceFor(anchor);
        await moveToNextRowScoreTab(active, config, anchor, xTol);
      }
      await sleep(Math.max(delayMs, MIN_STEP_MS));
      const el = resolveFocusedInput();
      if (el) el.focus();
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

    if (!resolveFocusedInput()) {
      isRunning = false;
      throw new Error(
        config.rowNav === 'score-tab'
          ? '지필평가 서답형 점수 칸을 클릭한 뒤 다시 시도해 주세요.'
          : '나이스 입력칸을 먼저 클릭한 후 다시 시도해 주세요.'
      );
    }

    let currentRowIndex = startRow;
    let processedRows = 0;
    const endRow = mode === 'one' ? startRow + 1 : rows.length;
    const isScoreColumn = config.rowNav === 'score-tab';
    let scoreNav = null;
    let lastScoreEl = null;
    let lastScoreTop = null;

    if (isScoreColumn) {
      const startEl = resolveFocusedInput();
      if (!startEl) {
        isRunning = false;
        throw new Error('지필평가 서답형 점수 칸을 클릭한 뒤 다시 시도해 주세요.');
      }
      scoreNav = createScoreNavigator(startEl);
      if (!scoreNav) {
        isRunning = false;
        throw new Error('지필평가 표에서 서답형 점수 칸을 클릭한 뒤 다시 시도해 주세요.');
      }
    }

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

          const rawValue = row[c];
          if (rawValue === undefined || rawValue === '') continue;
          const value = isScoreColumn ? normalizeScoreText(rawValue) : rawValue;

          let activeEl = null;
          const scoreOffset = r - startRow;

          if (isScoreColumn) {
            activeEl = await resolveScoreInput(scoreNav, scoreOffset, config, lastScoreEl, lastScoreTop);
          } else {
            activeEl = findWritableInput(config);
          }

          if (!activeEl) {
            const moveHint =
              config.rowNav === 'score-tab'
                ? '표를 조금 위로 올린 뒤 1번 학생 서답형 칸을 다시 클릭'
                : rowEndType === 'enter'
                  ? 'Enter 방식'
                  : `Tab ${tabsAfterRow}번 방식`;
            throw new Error(
              `${r + 1}행 ${c + 1}열: 입력칸을 찾을 수 없습니다. (${moveHint})`
            );
          }

          setElementValue(activeEl, value);
          await settleAfterInput(activeEl, value, delayMs, {
            scoreTab: isScoreColumn,
            commitBlur: !(isScoreColumn && scoreNav),
          });

          lastScoreEl = activeEl;
          lastScoreTop = getInputRect(activeEl).top;

          const isLastCell = c === row.length - 1;
          if (!isLastCell) {
            await moveToNextCell(tabsBetweenCells, delayMs);
          } else if (mode !== 'one' && !isScoreColumn) {
            await moveToNextRow(config, r, rows.length);
          } else if (mode !== 'one' && isScoreColumn && !scoreNav) {
            await moveToNextRow(config, r, rows.length);
          } else if (mode !== 'one' && isScoreColumn) {
            await sleep(15);
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
