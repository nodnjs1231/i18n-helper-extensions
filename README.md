# i18n Helper Extension

웹 페이지의 다국어 json 파일을 만들어주는 Chrome Extension입니다.

## 주요 기능

### 1. 텍스트 추출 기능

-   공백만 있는 텍스트 제외
-   숨겨진 요소 제외

### 2. 키 관리 기능

-   텍스트 기반 자동 키 생성
-   중복 키 자동 처리

### 3. 번역 관리 기능

-   3개 언어 동시 관리 (한국어, 영어, 일본어)
-   번역 데이터 JSON 형식 저장/내보내기

## 설치 방법

1. 이 저장소를 클론하거나 다운로드합니다.
2. Chrome 브라우저에서 `chrome://extensions`로 이동합니다.
3. 우측 상단의 "개발자 모드"를 활성화합니다.
4. "압축해제된 확장 프로그램을 로드합니다" 버튼을 클릭합니다.
5. 다운로드한 폴더를 선택합니다.

## 사용 방법

1. 다국어 처리가 필요한 웹 페이지에 접속합니다.
2. Chrome 툴바의 i18n Helper 아이콘을 클릭합니다.
3. "전체 텍스트 추출" 버튼을 클릭하여 페이지의 모든 텍스트를 한 번에 추출할 수 있습니다.
4. 언어 탭을 전환하여 각 언어별 번역 상태를 확인합니다.
5. "JSON 내보내기" 버튼을 클릭하여 번역 파일을 다운로드합니다.

## 개발 환경 설정

### 필요 조건

-   Chrome 브라우저
-   Node.js (개발 시)

### 개발 모드 실행

1. 저장소 클론

```bash
git clone https://github.com/nodnjs1231/i18n-helper-extension.git
cd i18n-helper-extension
```

2. Chrome에서 개발자 모드로 로드

-   `chrome://extensions` 접속
-   개발자 모드 활성화
-   "압축해제된 확장 프로그램을 로드합니다" 클릭
-   프로젝트 폴더 선택

## 기여 방법

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 작성자

Your Name - [@nodnjs1231](https://github.com/nodnjs1231)

프로젝트 링크: [https://github.com/nodnjs1231/i18n-helper-extension](https://github.com/nodnjs1231/i18n-helper-extension)
