(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const fileInput = $('fileInput');
  const fileDropZone = $('fileDropZone');
  const fileName = $('fileName');
  const fileSource = $('fileSource');
  const pasteSource = $('pasteSource');
  const pasteInput = $('pasteInput');
  const btnPasteLoad = $('btnPasteLoad');
  const sourceTabs = document.querySelectorAll('.source-tab');
  const sheetRow = $('sheetRow');
  const sheetSelect = $('sheetSelect');
  const startRow = $('startRow');
  const startCol = $('startCol');
  const endCol = $('endCol');
  const skipHeader = $('skipHeader');
  const menuPreset = $('menuPreset');
  const presetBadge = $('presetBadge');
  const advancedSection = $('advancedSection');
  const btnAdvancedGuide = $('btnAdvancedGuide');
  const advancedGuide = $('advancedGuide');
  const tabsBetweenCells = $('tabsBetweenCells');
  const tabsAfterRow = $('tabsAfterRow');
  const rowEndType = $('rowEndType');
  const delayMs = $('delayMs');
  const previewSection = $('previewSection');
  const previewMeta = $('previewMeta');
  const previewTable = $('previewTable');
  const btnAll = $('btnAll');
  const btnOne = $('btnOne');
  const btnStop = $('btnStop');
  const statusEl = $('status');

  let workbook = null;
  let rawGrid = null;
  let dataSource = 'file';
  let parsedRows = [];
  let currentRowIndex = 0;

  initMenuPresets();
  loadSettings();
  loadInputStatus();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.inputStatus || changes.inputStatusType) {
      loadInputStatus();
    }
  });

  fileInput.addEventListener('change', handleFileSelect);
  setupFileDropZone();
  sourceTabs.forEach((tab) => tab.addEventListener('click', () => switchDataSource(tab.dataset.source)));
  pasteInput.addEventListener('paste', handlePaste);
  pasteInput.addEventListener('input', handlePasteInput);
  btnPasteLoad.addEventListener('click', loadFromClipboard);
  sheetSelect.addEventListener('change', refreshPreview);
  startRow.addEventListener('change', refreshPreview);
  startCol.addEventListener('change', refreshPreview);
  endCol.addEventListener('change', refreshPreview);
  skipHeader.addEventListener('change', refreshPreview);
  menuPreset.addEventListener('change', handlePresetChange);
  tabsBetweenCells.addEventListener('change', handleManualSettingChange);
  tabsAfterRow.addEventListener('change', handleManualSettingChange);
  rowEndType.addEventListener('change', handleManualSettingChange);
  delayMs.addEventListener('change', saveSettings);
  btnAll.addEventListener('click', () => startInput('all'));
  btnOne.addEventListener('click', () => startInput('one'));
  btnStop.addEventListener('click', stopInput);
  btnAdvancedGuide.addEventListener('click', toggleAdvancedGuide);

  function toggleAdvancedGuide() {
    const open = advancedGuide.hidden;
    advancedGuide.hidden = !open;
    btnAdvancedGuide.setAttribute('aria-expanded', open ? 'true' : 'false');
    btnAdvancedGuide.textContent = open ? '접기' : '사용 방법';
  }

  async function loadInputStatus() {
    const data = await chrome.storage.local.get(['inputStatus', 'inputStatusType']);
    if (data.inputStatus) setStatus(data.inputStatus, data.inputStatusType || '');
  }

  function initMenuPresets() {
    menuPreset.innerHTML = '';
    MENU_PRESET_ORDER.forEach((key) => {
      const preset = MENU_PRESETS[key];
      if (!preset) return;
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = preset.label;
      menuPreset.appendChild(opt);
    });
  }

  function updateAdvancedVisibility(isCustom) {
    advancedSection.hidden = !isCustom;
    if (!isCustom) {
      advancedGuide.hidden = true;
      btnAdvancedGuide.setAttribute('aria-expanded', 'false');
      btnAdvancedGuide.textContent = '사용 방법';
    }
  }

  function applyPreset(key, save = true) {
    const preset = MENU_PRESETS[key] || MENU_PRESETS.custom;
    menuPreset.value = key;
    tabsBetweenCells.value = preset.tabsBetweenCells;
    tabsAfterRow.value = preset.tabsAfterRow;
    rowEndType.value = preset.rowEndType || 'enter';

    const isCustom = key === 'custom';
    tabsBetweenCells.disabled = !isCustom;
    tabsAfterRow.disabled = !isCustom;
    rowEndType.disabled = !isCustom;
    presetBadge.textContent = isCustom ? '고급' : '';
    updateAdvancedVisibility(isCustom);

    if (save) {
      chrome.storage.local.set({
        menuPreset: key,
        tabsBetweenCells: preset.tabsBetweenCells,
        tabsAfterRow: preset.tabsAfterRow,
        rowEndType: preset.rowEndType || 'enter',
        delayMs: Number(delayMs.value) || 70,
      });
    }
  }

  function handlePresetChange() {
    applyPreset(menuPreset.value);
  }

  function handleManualSettingChange() {
    if (menuPreset.value !== 'custom') {
      menuPreset.value = 'custom';
      tabsBetweenCells.disabled = false;
      tabsAfterRow.disabled = false;
      rowEndType.disabled = false;
      presetBadge.textContent = '고급';
      updateAdvancedVisibility(true);
    }
    saveSettings();
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get([
      'menuPreset',
      'tabsBetweenCells',
      'tabsAfterRow',
      'rowEndType',
      'delayMs',
    ]);

    if (data.menuPreset && MENU_PRESETS[data.menuPreset]) {
      applyPreset(data.menuPreset, false);
    } else if (data.menuPreset == null) {
      applyPreset('segmok', false);
    }

    if (data.tabsBetweenCells != null && data.menuPreset === 'custom') {
      tabsBetweenCells.value = data.tabsBetweenCells;
    }
    if (data.tabsAfterRow != null && data.menuPreset === 'custom') {
      tabsAfterRow.value = data.tabsAfterRow;
    }
    if (data.rowEndType != null && data.menuPreset === 'custom') {
      rowEndType.value = data.rowEndType;
    }
    if (data.delayMs != null) delayMs.value = data.delayMs;
  }

  function saveSettings() {
    chrome.storage.local.set({
      menuPreset: menuPreset.value,
      tabsBetweenCells: Number(tabsBetweenCells.value),
      tabsAfterRow: Number(tabsAfterRow.value),
      rowEndType: rowEndType.value,
      delayMs: Number(delayMs.value),
    });
  }

  function setStatus(msg, type = '') {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (type ? ` ${type}` : '');
  }

  function switchDataSource(source) {
    dataSource = source;
    sourceTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.source === source);
    });
    fileSource.hidden = source !== 'file';
    pasteSource.hidden = source !== 'paste';
    sheetRow.hidden = source !== 'file' || !workbook || workbook.SheetNames.length <= 1;

    if (source === 'paste') {
      const text = pasteInput.value.trim();
      if (text) {
        const grid = parseClipboardText(text);
        loadRawGrid(grid, `붙여넣기 (${grid.length}행)`);
      } else {
        rawGrid = null;
        resetDataState();
      }
      return;
    }

    refreshPreview();
  }

  function parseClipboardText(text) {
    if (!text || !text.trim()) return [];

    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
      } else if (ch === '\t') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch === '\r') {
        if (next === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }

    row.push(cell);
    if (row.some((c) => c !== '')) {
      rows.push(row);
    }

    return rows;
  }

  function trimTrailingEmptyCols(row) {
    const arr = Array.isArray(row) ? row.slice() : [];
    while (arr.length > 0) {
      const last = arr[arr.length - 1];
      if (last !== '' && last != null) break;
      arr.pop();
    }
    return arr;
  }

  function sliceGrid(raw) {
    const sRow = Math.max(1, Number(startRow.value) || 1) - 1;
    const sCol = Math.max(1, Number(startCol.value) || 1) - 1;
    const eCol = endCol.value ? Number(endCol.value) - 1 : null;

    let rows = raw.slice(sRow);
    if (skipHeader.checked && rows.length > 0) {
      rows = rows.slice(1);
    }

    return rows
      .map((row) => {
        let arr = Array.isArray(row) ? row.slice(sCol) : [];
        if (eCol != null) {
          arr = arr.slice(0, eCol - sCol + 1);
        }
        return trimTrailingEmptyCols(arr);
      })
      .filter((row) => row.some((cell) => cell !== '' && cell != null));
  }

  function loadRawGrid(raw, label) {
    rawGrid = raw;
    currentRowIndex = 0;
    if (label) fileName.textContent = label;
    refreshPreview();
  }

  function resetDataState() {
    currentRowIndex = 0;
    parsedRows = [];
    previewSection.hidden = true;
    previewTable.innerHTML = '';
    updateButtons();
  }

  function handlePasteInput() {
    if (dataSource !== 'paste') return;
    const grid = parseClipboardText(pasteInput.value);
    if (!grid.length) {
      rawGrid = null;
      resetDataState();
      return;
    }
    loadRawGrid(grid, `붙여넣기 (${grid.length}행)`);
  }

  function handlePaste(e) {
    if (dataSource !== 'paste') return;
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    pasteInput.value = text;
    const grid = parseClipboardText(text);
    loadRawGrid(grid, `붙여넣기 (${grid.length}행)`);
    setStatus('붙여넣기 데이터 로드 완료', 'success');
  }

  async function loadFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setStatus('클립보드가 비어 있습니다. 엑셀에서 먼저 복사해 주세요.', 'error');
        return;
      }
      pasteInput.value = text;
      const grid = parseClipboardText(text);
      loadRawGrid(grid, `붙여넣기 (${grid.length}행)`);
      setStatus('클립보드 데이터 로드 완료', 'success');
    } catch (err) {
      setStatus('클립보드 읽기 실패. 입력칸에 직접 Ctrl+V 해 주세요.', 'error');
    }
  }

  function isExcelFile(file) {
    if (!file) return false;
    return /\.(xlsx|xls|csv)$/i.test(file.name);
  }

  function setupFileDropZone() {
    if (!fileDropZone) return;

    fileDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileDropZone.classList.add('drag-over');
    });

    fileDropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (!fileDropZone.contains(e.relatedTarget)) {
        fileDropZone.classList.remove('drag-over');
      }
    });

    fileDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileDropZone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (!isExcelFile(file)) {
        setStatus('엑셀 파일(.xlsx, .xls, .csv)만 넣을 수 있습니다.', 'error');
        return;
      }
      loadExcelFile(file);
    });
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    await loadExcelFile(file);
    fileInput.value = '';
  }

  async function loadExcelFile(file) {
    if (!file) return;

    dataSource = 'file';
    switchDataSource('file');
    fileName.textContent = file.name;
    setStatus('파일을 읽는 중...');

    try {
      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: 'array' });

      sheetSelect.innerHTML = '';
      workbook.SheetNames.forEach((name) => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sheetSelect.appendChild(opt);
      });

      sheetRow.hidden = workbook.SheetNames.length <= 1;
      currentRowIndex = 0;

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      loadRawGrid(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }), file.name);
      setStatus(`${file.name} 로드 완료`, 'success');
    } catch (err) {
      setStatus('파일 읽기 실패: ' + err.message, 'error');
      workbook = null;
      rawGrid = null;
      resetDataState();
    }
  }

  function refreshPreview() {
    if (dataSource === 'file' && workbook) {
      const sheetName = sheetSelect.value || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rawGrid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    } else if (dataSource === 'paste') {
      const text = pasteInput.value.trim();
      rawGrid = text ? parseClipboardText(text) : null;
    }

    if (!rawGrid || !rawGrid.length) {
      parsedRows = [];
      previewSection.hidden = true;
      updateButtons();
      return;
    }

    parsedRows = sliceGrid(rawGrid);
    renderPreview(parsedRows);
    updateButtons();
  }

  function renderPreview(rows) {
    if (!rows.length) {
      previewSection.hidden = true;
      return;
    }

    previewSection.hidden = false;
    previewMeta.textContent = `총 ${rows.length}행 · ${rows[0]?.length || 0}열`;

    const maxPreview = Math.min(rows.length, 12);
    const cols = rows[0]?.length || 0;

    let html = '<thead><tr><th>#</th>';
    for (let c = 0; c < cols; c++) {
      html += `<th>${colLabel(c)}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (let r = 0; r < maxPreview; r++) {
      html += `<tr><td>${r + 1}</td>`;
      for (let c = 0; c < cols; c++) {
        const val = rows[r][c] ?? '';
        html += `<td title="${escapeHtml(String(val))}">${escapeHtml(String(val))}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody>';

    if (rows.length > maxPreview) {
      previewMeta.textContent += ` (미리보기 ${maxPreview}행)`;
    }

    previewTable.innerHTML = html;
  }

  function colLabel(index) {
    let label = '';
    let n = index;
    do {
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return label;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function updateButtons() {
    const hasData = parsedRows.length > 0;
    btnAll.disabled = !hasData;
    btnOne.disabled = !hasData;
  }

  function getInputSettings() {
    const key = menuPreset.value;
    const preset = MENU_PRESETS[key] || MENU_PRESETS.custom;
    const isCustom = key === 'custom';

    return {
      tabsBetweenCells: isCustom
        ? Number(tabsBetweenCells.value) || 0
        : preset.tabsBetweenCells,
      tabsAfterRow: isCustom ? Number(tabsAfterRow.value) || 0 : preset.tabsAfterRow,
      rowEndType: isCustom ? rowEndType.value || 'enter' : preset.rowEndType || 'enter',
      rowNav: preset.rowNav || 'default',
    };
  }

  function getConfig(mode) {
    const input = getInputSettings();
    return {
      rows: parsedRows,
      startRow: mode === 'one' ? currentRowIndex : 0,
      tabsBetweenCells: input.tabsBetweenCells,
      tabsAfterRow: input.tabsAfterRow,
      rowEndType: input.rowEndType,
      rowNav: input.rowNav,
      delayMs: Number(delayMs.value) || 70,
      mode,
      skipEmptyRows: true,
    };
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function isNeisUrl(url) {
    if (!url) return false;
    return /\.neis\.go\.kr|\.eduptl\.kr/.test(url);
  }

  async function ensureContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ['content/content.js'],
      });
    } catch {
      // 이미 주입됨 또는 activeTab 미허용
    }
  }

  async function startInput(mode) {
    saveSettings();

    const tab = await getActiveTab();
    if (!tab?.id) {
      setStatus('활성 탭을 찾을 수 없습니다.', 'error');
      return;
    }

    if (!isNeisUrl(tab.url)) {
      setStatus('나이스(NEIS) 페이지에서 사용해 주세요.', 'error');
      return;
    }

    if (mode === 'one' && currentRowIndex >= parsedRows.length) {
      setStatus('모든 행 입력이 완료되었습니다.', 'success');
      return;
    }

    btnAll.disabled = true;
    btnOne.disabled = true;
    btnStop.hidden = false;
    setStatus('8초 안에 나이스 첫 입력칸을 클릭하세요!');

    try {
      await chrome.tabs.update(tab.id, { active: true });
      await ensureContentScript(tab.id);
      refreshPreview();
      const config = getConfig(mode);
      const response = await chrome.runtime.sendMessage({
        type: 'RUN_INPUT',
        tabId: tab.id,
        config,
        mode,
      });

      if (!response?.ok) {
        throw new Error(response?.error || '입력 실패');
      }

      if (mode === 'one') {
        currentRowIndex = response.nextRowIndex ?? currentRowIndex + 1;
      } else {
        currentRowIndex = response.nextRowIndex ?? parsedRows.length;
      }
    } catch (err) {
      const msg = err.message || String(err);
      if (!msg.includes('message port closed')) {
        setStatus(msg, 'error');
      }
    } finally {
      btnStop.hidden = true;
      updateButtons();
    }
  }

  async function stopInput() {
    const tab = await getActiveTab();
    if (tab?.id) {
      await chrome.runtime.sendMessage({ type: 'STOP_INPUT', tabId: tab.id });
    }
    setStatus('중지 요청됨...');
  }
})();
