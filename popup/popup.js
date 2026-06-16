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
  const tabsBetweenCells = $('tabsBetweenCells');
  const tabsAfterRow = $('tabsAfterRow');
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

  loadSettings();

  fileInput.addEventListener('change', handleFileSelect);
  sheetSelect.addEventListener('change', refreshPreview);
  startRow.addEventListener('change', refreshPreview);
  startCol.addEventListener('change', refreshPreview);
  endCol.addEventListener('change', refreshPreview);
  skipHeader.addEventListener('change', refreshPreview);
  tabsBetweenCells.addEventListener('change', saveSettings);
  tabsAfterRow.addEventListener('change', saveSettings);
  delayMs.addEventListener('change', saveSettings);
  btnAll.addEventListener('click', () => startInput('all'));
  btnOne.addEventListener('click', () => startInput('one'));
  btnStop.addEventListener('click', stopInput);

  async function loadSettings() {
    const data = await chrome.storage.local.get([
      'tabsBetweenCells',
      'tabsAfterRow',
      'delayMs',
    ]);
    if (data.tabsBetweenCells != null) tabsBetweenCells.value = data.tabsBetweenCells;
    if (data.tabsAfterRow != null) tabsAfterRow.value = data.tabsAfterRow;
    if (data.delayMs != null) delayMs.value = data.delayMs;
  }

  function saveSettings() {
    chrome.storage.local.set({
      tabsBetweenCells: Number(tabsBetweenCells.value),
      tabsAfterRow: Number(tabsAfterRow.value),
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

  function getConfig(mode) {
    return {
      rows: parsedRows,
      startRow: mode === 'one' ? currentRowIndex : 0,
      tabsBetweenCells: Number(tabsBetweenCells.value) || 0,
      tabsAfterRow: Number(tabsAfterRow.value) || 0,
      delayMs: Number(delayMs.value) || 150,
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
        // frame without content script
      }
    }
    return null;
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

    const frameId = await findFocusedFrame(tab.id);
    if (frameId == null) {
      setStatus('나이스 입력칸을 먼저 클릭한 뒤 다시 시도해 주세요.', 'error');
      return;
    }

    btnAll.disabled = true;
    btnOne.disabled = true;
    btnStop.hidden = false;
    setStatus(mode === 'all' ? '전체 입력 중... (입력칸에 포커스 유지)' : `${currentRowIndex + 1}행 입력 중...`);

    try {
      const config = getConfig(mode);
      const messageType = mode === 'one' ? 'INPUT_ONE_ROW' : 'START_INPUT';

      const response = await chrome.tabs.sendMessage(
        tab.id,
        { type: messageType, config },
        { frameId }
      );

      if (!response?.ok) {
        throw new Error(response?.error || '입력 실패');
      }

      if (mode === 'one') {
        currentRowIndex = response.nextRowIndex ?? currentRowIndex + 1;
        setStatus(
          `${response.processedRows}행 입력 완료. 다음: ${currentRowIndex + 1}행`,
          'success'
        );
      } else {
        currentRowIndex = response.nextRowIndex ?? parsedRows.length;
        if (response.stopped) {
          setStatus(`중지됨. ${response.processedRows}행까지 입력`, 'success');
        } else {
          setStatus(`전체 ${response.processedRows}행 입력 완료`, 'success');
        }
      }
    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes('Receiving end does not exist')) {
        setStatus('나이스 페이지를 새로고침한 뒤 다시 시도해 주세요.', 'error');
      } else {
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
      const frameId = await findFocusedFrame(tab.id);
      if (frameId != null) {
        await chrome.tabs.sendMessage(tab.id, { type: 'STOP_INPUT' }, { frameId });
      }
    }
    setStatus('중지 요청됨...');
  }
})();
