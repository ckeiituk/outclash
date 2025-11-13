## v0.2.4
- fixed issue with error 0xc00000142 when shutting down the computer
- dark mode issue fixed
- improved HWID definition
- fixed an issue with opening a window via a shortcut when the application is already running
- fixed uploading updater for macos
- menu removed by right-clicking
- allowed to set an empty password on an external controller

---

## v0.2.2
- fixed bug in proxy groups menu
- added message about global mode enabled on main screen
- fixed minor bugs
- updated Mihomo core to v1.19.14

Fixes

- Windows installer: terminate new `out-mihomo(.exe)` and `out-mihomo-alpha(.exe)` processes before copying files to avoid "cannot open file" errors during upgrade.

CI/Release

- Bump release version to 0.2.2.

---

## v0.2.1

New

- Version sync and verification: added `sync-version` and `verify-version` scripts. Versions in `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` are auto-synced from `package.json` before builds (locally and in CI) and verified for consistency.

Fixes

- Linux (Ubuntu) linking in CI: install `build-essential`, `pkg-config`, and `libc6-dev` to fix missing CRT objects (`Scrt1.o`, `crti.o`, etc.).

CI/Release

- Unified release uploads to always use the `package.json` version (single source of truth) across all jobs.
- Added sync + verify steps to dev/release/alpha workflows for early detection of version drift.
- Consistent Windows artifact renaming based on the unified version.

Known limitations

- macOS builds remain disabled.

## v0.2.0

New

- Home: added Rule/Global mode switch.
- Home: added a quick “Switch to …” button to toggle between System Proxy and TUN.
- Network requests include an OutClash identifier in the User-Agent header.

Fixes

- RU locale: removed duplicate keys and refined wording.

CI/Release

- Update manifests (including Fixed WebView2) are generated for matching tags.

Known limitations

- macOS builds remain disabled.

## v0.1.0

**🎉 First release of OutClash as independent project**

- project fully renamed from Clash Verge Rev to OutClash
- service binaries renamed: to `outclash-service`
- updated all configurations and build scripts for new project name
- macOS builds temporarily disabled (no certificate available)
- updated project identifier
- all dependencies and configurations updated
