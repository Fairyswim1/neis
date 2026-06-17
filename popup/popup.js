(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const fileInput = $('fileInput');
  const fileName = $('fileName');
  const sheetRow = $('sheetRow');
  const sheetSelect = $('sheetSelect');
  const startRow = $('startRow');
  const startCol = $('startCol');
  const endCol = $('endCol');
  const skipHeader = $('skipHeader');
  const menuPreset = $('menuPreset');
  const presetBadge = $('presetBadge');
  const presetGuide = $('presetGuide');
  const advancedSection = $('advancedSection');
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

    if (preset.guide) {
      presetGuide.textContent = preset.guide;
      presetGuide.hidden = isCustom;
    } else if (!isCustom) {
      presetGuide.textContent = getPresetNavHint(preset);
      presetGuide.hidden = false;
    } else {
      presetGuide.hidden = true;
      presetGuide.textContent = '';
    }

    if (save) {
      chrome.storage.local.set({
        menuPreset: key,
        tabsBetweenCells: preset.tabsBetweenCells,
        tabsAfterRow: preset.tabsAfterRow,
        rowEndType: preset.rowEndType || 'enter',
        delayMs: Number(delayMs.value) || 100,
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
      presetGuide.hidden = true;
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

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

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
      refreshPreview();
      setStatus(`${file.name} 로드 완료`, 'success');
    } catch (err) {
      setStatus('파일 읽기 실패: ' + err.message, 'error');
      workbook = null;
      parsedRows = [];
      updateButtons();
    }
  }

  function refreshPreview() {
    if (!workbook) {
      parsedRows = [];
      previewSection.hidden = true;
      updateButtons();
      return;
    }

    const sheetName = sheetSelect.value || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const sRow = Math.max(1, Number(startRow.value) || 1) - 1;
    const sCol = Math.max(1, Number(startCol.value) || 1) - 1;
    let eCol = endCol.value ? Number(endCol.value) - 1 : null;

    let rows = raw.slice(sRow);
    if (skipHeader.checked && rows.length > 0) {
      rows = rows.slice(1);
    }

    parsedRows = rows
      .map((row) => {
        const arr = Array.isArray(row) ? row.slice(sCol) : [];
        if (eCol != null) {
          return arr.slice(0, eCol - sCol + 1);
        }
        return arr;
      })
      .filter((row) => row.some((cell) => cell !== '' && cell != null));

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

    const maxPreview = Math.min(rows.length, 8);
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

  function getPresetNavHint(preset) {
    if (preset.guide) return preset.guide;
    if (preset.rowEndType === 'enter') {
      return '다음 행: Enter 키 · 칸 사이: Tab ' + preset.tabsBetweenCells + '번';
    }
    if (preset.rowEndType === 'tab') {
      return `다음 행: Tab ${preset.tabsAfterRow}번 · 칸 사이: Tab ${preset.tabsBetweenCells}번`;
    }
    if (preset.rowEndType === 'enter-then-tab') {
      return `다음 행: Enter → Tab ${preset.tabsAfterRow}번`;
    }
    return '다음 행: 자동 찾기';
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
      delayMs: Number(delayMs.value) || 100,
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
    setStatus('5초 안에 나이스 첫 입력칸을 클릭하세요!');

    try {
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
