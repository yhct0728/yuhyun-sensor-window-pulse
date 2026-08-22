const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    // 앱(.exe) 아이콘 — 확장자 제외. Windows 는 assets/icon.ico, mac 은 assets/icon.icns 를 자동 선택.
    icon: 'assets/icon',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // 설치 마법사/Setup.exe 아이콘 (Windows, .ico 필수)
        setupIcon: 'assets/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  publishers: [
    {
      // 새 버전을 GitHub Releases 로 올린다. `npm run publish` 한 줄로 배포.
      //   설치본은 update.electronjs.org 를 통해 이 릴리스를 확인하고 자동 갱신한다.
      //   ⚠️ 저장소가 **공개**여야 update.electronjs.org 가 읽을 수 있다.
      //   토큰: 환경변수 GITHUB_TOKEN (repo 권한)
      name: '@electron-forge/publisher-github',
      config: {
        repository: { owner: 'yhct0728', name: 'yuhyun-sensor-window-pulse' },
        prerelease: false,
        draft: false, // 즉시 공개 — draft 면 업데이트 서버가 못 본다
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
