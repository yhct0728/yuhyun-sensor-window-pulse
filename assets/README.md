# assets — 앱 아이콘

여기에 **`icon.ico`** 파일을 넣으세요. (이 폴더/파일명을 `forge.config.js`가 참조합니다.)

- `packagerConfig.icon: 'assets/icon'` → 앱 실행파일(.exe) 아이콘
- `maker-squirrel.config.setupIcon: 'assets/icon.ico'` → 설치 마법사(Setup.exe) 아이콘

## 요구사항
- **Windows: `.ico` 형식 필수** (여러 크기 16~256px 포함 권장). PNG만 있으면 .ico 로 변환해서 넣어야 합니다.
- (선택) macOS 빌드도 하려면 같은 폴더에 `icon.icns` 도 두면 됩니다.

## 넣은 뒤
`npm run make` → `out/make/squirrel.windows/x64/` 에 아이콘이 적용된 설치본이 생성됩니다.
