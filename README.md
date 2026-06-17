# 나이스 복붙 요정 🧚

엑셀(`.xlsx`, `.xls`, `.csv`) 데이터를 **나이스(NEIS)** 입력창에 자동으로 붙여넣는 Chrome 확장 프로그램입니다.

## 주요 기능

- **사이드 패널** UI — 나이스 화면을 가리지 않음
- 나이스 **메뉴별 프리셋** (지필평가, 수행평가, 행동특성, 자율활동)
- 엑셀 파일 업로드 및 시트 선택
- **Enter** 기본 다음 행 이동 + 메뉴별 행 끝 Tab 설정
- **전체 입력** / **한 행 입력** 모드

## 메뉴 프리셋

| 메뉴 | 셀 간 Tab | 행 끝 Tab | 다음 행 |
|------|-----------|-----------|---------|
| 지필평가 입력 | 1 | 6 | Tab |
| 수행평가 점수 입력 | 1 | — | Enter |
| 과목별세부능력및특기사항 | 1 | 2 | Tab |
| 과목별독서활동 | 1 | 2 | Tab |
| 진로활동 | 1 | — | Enter (2열/행) |
| 행동특성 및 종합의견 | 1 | 2 | Tab |
| 자율활동 기록 | 1 | 3 | Tab |
| 직접 설정 | 수동 | 수동 | 수동 |

### 진로활동 (학생당 2칸)

엑셀에서 **1행 = 학생 1명**, **2열**로 준비합니다.

| A열 | B열 |
|-----|-----|
| 특기사항 | 희망분야 |
| (1번 학생) | (1번 학생) |
| (2번 학생) | (2번 학생) |

나이스에서는 **1번 학생 왼쪽 칸(특기사항)** 을 클릭한 뒤 입력을 시작하면, A열 → Tab → B열 → Enter → 다음 학생 A열 순으로 자동 입력됩니다.

## 설치 방법 (본인 PC)

### 개발자용 (소스에서)

```bash
git clone https://github.com/Fairyswim1/neis.git
cd neis
npm install
```

1. Chrome 주소창 → `chrome://extensions`
2. **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** → `neis` 폴더 선택

### ZIP으로 설치 (다른 선생님 배포용)

1. [GitHub Releases](https://github.com/Fairyswim1/neis/releases)에서 `neis-input-helper.zip` 다운로드
2. ZIP **압축 풀기** (폴더 하나 생김)
3. `chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램을 로드합니다**
4. **압축 푼 폴더** 선택 (`manifest.json`이 있는 폴더)

## 사용 방법

1. [나이스(NEIS)](https://www.neis.go.kr/) 업무 화면을 엽니다.
2. Chrome **퍼즐 아이콘** → **나이스 복붙 요정** 클릭 → **오른쪽 사이드 패널**이 열립니다.
3. **나이스 메뉴** 선택 (예: 지필평가 입력)
4. 엑셀 파일 선택
5. **전체 입력** 클릭 → 5초 안에 나이스 **첫 입력칸** 클릭

> 사이드 패널은 화면 **오른쪽**에 붙어 있어 나이스 입력 화면을 가리지 않습니다.

## 다른 선생님께 배포하기

### 방법 1: ZIP 파일 공유 (가장 쉬움, 추천)

```bash
npm run package
```

생성된 `dist/neis-input-helper.zip`을 카카오톡, 이메일, 학교 NAS 등으로 공유합니다.

받는 분 설치 방법:
1. ZIP 압축 풀기
2. `chrome://extensions` → 개발자 모드 ON
3. **압축해제된 확장 프로그램을 로드합니다** → 푼 폴더 선택

### 방법 2: GitHub Releases

1. GitHub 저장소 → **Releases** → **Create a new release**
2. `npm run package`로 만든 ZIP 첨부
3. Release URL을 선생님들에게 공유

### 방법 3: Chrome 웹 스토어 (공식 배포)

- [Chrome Web Store Developer](https://chrome.google.com/webstore/devconsole) 등록 (1회 $5)
- 확장 프로그램 ZIP 업로드 → Google 심사 (수일~수주)
- 심사 통과 후 링크 하나로 누구나 **설치** 가능 (개발자 모드 불필요)

학교 전체 배포에는 웹 스토어가 가장 편하지만, 등록·심사 시간이 필요합니다.

### 방법 4: 학교 IT 관리자 (Group Policy)

학교에서 Chrome을 일괄 관리하는 경우, IT 관리자가 **Force-install** 정책으로 확장을 밀어 넣을 수 있습니다.

## 프로젝트 구조

```
neis/
├── manifest.json
├── popup/           # 사이드 패널 UI
├── content/         # 나이스 자동 입력
├── background/
├── lib/
├── icons/
└── scripts/
```

## 주의사항

- 공식 나이스 API가 아닌 **화면 입력 보조 도구**입니다.
- 입력 전 **미리보기**로 데이터를 확인하세요.
- 소량 테스트 후 전체 입력하세요.

## 라이선스

MIT
