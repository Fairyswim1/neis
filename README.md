# 나이스 입력 도우미

엑셀(`.xlsx`, `.xls`, `.csv`) 데이터를 **나이스(NEIS)** 입력창에 자동으로 붙여넣는 Chrome 확장 프로그램입니다.

## 주요 기능

- 엑셀 파일 업로드 및 시트 선택
- 시작/끝 행·열, 헤더 건너뛰기 설정
- 셀 간 Tab 횟수, 행 끝 Tab 횟수 조절
- **전체 입력** / **한 행 입력** 모드
- 나이스 iframe 내부 입력칸 지원

## 설치 방법

### 1. 저장소 클론

```bash
git clone https://github.com/Fairyswim1/neis.git
cd neis
npm install
node scripts/generate-icons.js
```

> `lib/xlsx.full.min.js`는 `npm install` 후 `node_modules/xlsx/dist/`에서 복사됩니다.  
> 클론 직후 없다면: `Copy-Item node_modules\xlsx\dist\xlsx.full.min.js lib\` (Windows)

### 2. Chrome에 확장 프로그램 로드

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 프로젝트 폴더(`neis`) 선택

## 사용 방법

1. [나이스(NEIS)](https://www.neis.go.kr/) 업무 화면을 엽니다.
2. 확장 프로그램 아이콘을 클릭해 팝업을 엽니다.
3. 엑셀 파일을 선택하고, 시트·범위·Tab 설정을 맞춥니다.
4. 나이스 화면에서 **첫 번째 입력칸**을 클릭합니다.
5. **전체 입력** 또는 **한 행 입력** 버튼을 누릅니다.

### Tab 횟수 설정 팁

나이스 화면마다 입력칸 사이 이동 방식이 다릅니다. 아래 순서로 맞춰 보세요.

1. 엑셀에서 한 행만 준비합니다.
2. 나이스 첫 입력칸을 클릭합니다.
3. 키보드로 수동 입력 후, **셀 간 Tab 횟수**를 세어 입력합니다.
4. 한 행이 끝난 뒤 다음 행 첫 칸까지 Tab 횟수를 **행 끝 Tab 횟수**에 입력합니다.

## 프로젝트 구조

```
neis/
├── manifest.json          # Chrome 확장 설정
├── popup/                 # 팝업 UI
├── content/               # 나이스 페이지 자동 입력 스크립트
├── background/            # 백그라운드 서비스 워커
├── lib/                   # SheetJS (xlsx)
├── icons/                 # 확장 아이콘
└── scripts/               # 빌드 유틸
```

## 주의사항

- 공식 나이스 API가 아닌 **화면 입력 보조 도구**입니다.
- 입력 전 반드시 **미리보기**로 데이터를 확인하세요.
- 중요한 데이터는 소량으로 테스트한 뒤 전체 입력하세요.
- 4세대 나이스 전환 등 시스템 변경 시 Tab 설정을 다시 확인해야 할 수 있습니다.

## 라이선스

MIT
