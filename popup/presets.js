const MENU_PRESETS = {
  haengdong: {
    label: '행동특성 및 종합의견',
    tabsBetweenCells: 1,
    tabsAfterRow: 2,
    rowEndType: 'tab',
  },
  segmok: {
    label: '세부능력특기사항',
    tabsBetweenCells: 1,
    tabsAfterRow: 2,
    rowEndType: 'tab',
    guide: '과목별·개인별 세특 · 1번 학생 입력칸 클릭 · 다음 학생 Tab 2번',
  },
  dokseo: {
    label: '과목별독서활동',
    tabsBetweenCells: 1,
    tabsAfterRow: 2,
    rowEndType: 'tab',
    guide: '1번 학생 입력칸 클릭 · 다음 학생으로 Tab 2번',
  },
  jinrohope: {
    label: '진로희망사항기록',
    tabsBetweenCells: 1,
    tabsAfterRow: 1,
    rowEndType: 'tab',
    guide:
      '엑셀 4열=학생 1명 · A특기/흥미 B희망(학생) C희망(학부모) D특기사항 · 1번 학생 첫 칸 클릭',
  },
  jayul: {
    label: '자율활동 기록',
    tabsBetweenCells: 1,
    tabsAfterRow: 3,
    rowEndType: 'tab',
  },
  jipil: {
    label: '지필평가 입력',
    tabsBetweenCells: 1,
    tabsAfterRow: 6,
    rowEndType: 'tab',
  },
  suhaeng: {
    label: '수행평가 점수 입력',
    tabsBetweenCells: 1,
    tabsAfterRow: 0,
    rowEndType: 'enter',
  },
  custom: {
    label: '직접 설정 (고급)',
    tabsBetweenCells: 1,
    tabsAfterRow: 0,
    rowEndType: 'enter',
  },
};

/** 드롭다운 표시 순서 */
const MENU_PRESET_ORDER = [
  'segmok',
  'dokseo',
  'jinrohope',
  'jayul',
  'haengdong',
  'jipil',
  'suhaeng',
  'custom',
];
