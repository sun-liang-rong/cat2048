# Cocos Loading Progress Bridge

**Date:** 2026-08-05

**Status:** Draft for review

## Goal

Use the Cocos Creator WeChat first screen as the only visible loading page. Keep it visible until the project's remote `resources/game` bundle has finished loading, and feed that runtime asset progress into the Cocos progress bar. Remove the project's separate `LoadingView` from the startup experience.

## Evidence

Cocos Creator 3.8.8 generates `first-screen.js` and calls it from the generated `game.js` even when `useSplashScreen` and `wechatgame.separateEngine` are both `false`. The latest build log records both options as `false`, while the generated build still contains `first-screen.js` and calls `firstScreen.start`, `setProgress`, and `end`.

The current application starts `Cat2048Boot` after `firstScreen.end()`. `Cat2048Boot.initialize()` then displays the project-owned `LoadingView` while `ArtRepository.preload()` loads `resources/game`. Removing only the view would make the Cocos screen disappear before the remote runtime assets are ready.

## Requirements

- Keep Cocos' generated `first-screen.js`, `logo.png`, and `slogan.png` in the WeChat main package.
- Preserve Cocos' engine/application progress behavior through the existing early startup stages.
- Map runtime resource progress to the remaining Cocos progress range.
- Do not display the project-owned `LoadingView` at any point during startup.
- Do not show the home screen until all required runtime assets have loaded and runtime fonts are installed.
- Make the generated `game.js` patch idempotent and fail loudly if the Cocos 3.8.8 template changes.
- Apply the patch automatically for every WeChat build through a Cocos build extension hook, with a CLI fallback for fixture testing and manual recovery.
- Keep non-WeChat builds unchanged.

## Non-Goals

- Do not replace or redesign the Cocos first-screen artwork.
- Do not remove the Cocos first-screen files from the package.
- Do not change the runtime asset directory structure or remote bundle configuration.
- Do not add an artificial loading delay.

## Architecture

### Generated startup bridge

The build hook patches the generated WeChat `game.js` at the stable Cocos 3.8.8 integration points. It adds a small global bridge before `application.start()`:

- `setProgress(ratio)` maps `[0, 1]` to the Cocos range `[0.6, 0.99]` and delegates to `firstScreen.setProgress()`.
- `markReady()` resolves a startup promise held by the generated bootstrap.
- `markError(error)` records the failure and leaves the Cocos screen visible instead of revealing an incomplete scene.

The generated startup sequence remains responsible for engine initialization. After `application.start()` invokes `Cat2048Boot.onLoad()`, the application reports runtime asset progress through the bridge. The bootstrap calls `firstScreen.end()` only after `markReady()` resolves.

The patch includes a source marker so it can be safely applied more than once. It validates all expected source anchors before writing; unsupported generated templates fail without producing a partial patch.

### Application startup

`Cat2048Boot` remains responsible for the resource barrier, because Cocos' built-in progress does not include the remote `resources/game` bundle. Its startup flow changes as follows:

1. Do not call `showLoading()`.
2. Call `ArtRepository.preload()` as before.
3. Forward normalized preload progress to the Cocos bridge.
4. After preload succeeds, install runtime fonts, show the home screen, and call `markReady()`.
5. On failure, log the error and call `markError()`; do not show the home screen.

The `assetsReady` flag remains in place to protect interaction handlers and to distinguish the preloaded state during resize events. Resize handling updates the canvas but does not construct a second loading screen while assets are pending.

The `LoadingView` class and its associated loading-only screen branch are removed once the bridge is in place. `runStartupSequence` and the resource-loading tests remain because the asset barrier is still required.

### Build integration

Add a project-local Cocos Creator extension with a WeChat-only builder hook. The hook resolves the actual output directory from the build options and invokes the shared Node patcher. The patcher is also exposed through an npm command so it can be run against a completed fixture or a build when the editor extension is unavailable.

The hook must:

- skip non-WeChat platforms;
- require `game.js` and `first-screen.js` before patching;
- patch only the generated bootstrap file;
- preserve the generated Cocos loading assets;
- report a clear build error when the template is unsupported.

## Error Handling

Runtime asset failures keep the Cocos first screen visible and log the original error. They must not call `markReady()` or reveal a partially initialized home screen.

Build-time failures stop the build hook with the missing file or unsupported template named in the error. The CLI fallback has the same validation behavior.

## Verification

Automated tests will cover:

- generated `game.js` patching and idempotency;
- rejection of an unsupported Cocos bootstrap template;
- progress mapping and ready/error bridge calls from `Cat2048Boot`;
- the existing resource barrier and startup sequence tests;
- the WeChat build verifier requiring the Cocos first-screen and the runtime bridge marker.

Manual acceptance in WeChat Developer Tools:

1. Build the WeChat game through Cocos Creator with the extension enabled.
2. Confirm the first visible page is Cocos' first screen.
3. Confirm the Cocos progress bar advances while the remote `resources/game` assets load.
4. Confirm no project `LoadingView` appears between the Cocos page and the home screen.
5. Confirm the home screen appears only after images, fonts, and audio have loaded.
6. Confirm a failed resource request leaves the Cocos loading screen visible and logs an error.
