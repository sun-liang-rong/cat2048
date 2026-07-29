# Custom WeChat Loading Screen Design

**Date:** 2026-07-29

**Status:** Approved for implementation planning

## Goal

Replace the Cocos Creator branding shown before the Cat 2048 scene starts with a lightweight, project-owned loading screen that appears immediately in the WeChat mini-game.

## Evidence

The WeChat build profile already sets `useSplashScreen` to `false`, so the visible branding does not come from the normal Cocos scene splash setting. Because the build uses the separate-engine mode, Cocos Creator 3.8.8 generates an earlier first-screen layer in `game/build/wechatgame/first-screen.js`, together with `logo.png` and `slogan.png`. `game.js` starts that layer before importing the application and updates its progress while the engine initializes.

The generated build directory is ignored by Git and is replaced whenever Cocos rebuilds the project. Editing the generated files manually would therefore be temporary.

## Visual Design

Use a portrait loading screen consistent with the existing Cat 2048 art direction:

- warm ivory full-screen background instead of the current near-black background;
- one existing Cat 2048 cat illustration centered slightly above the vertical midpoint;
- the title `猫咪 2048` below the cat;
- a small rounded progress track below the title, with a coral fill and a dark warm outline;
- no Cocos logo, slogan, or other third-party branding;
- no heavy background illustration or elaborate animation, keeping the first screen fast and visually stable.

The layout must scale from the actual canvas dimensions and remain centered on common portrait phone aspect ratios. The cat and title preserve their aspect ratios rather than stretching to fill the screen.

## Architecture

Add a source-controlled customization script that runs against a completed WeChat build. It will:

1. validate that the expected Cocos-generated first-screen files exist;
2. replace the generated logo and slogan images with compact Cat 2048 loading assets;
3. patch only the documented first-screen configuration and layout constants needed for the background, artwork, and progress bar;
4. fail with a clear error if the generated Cocos template no longer matches the expected 3.8.8 structure.

The script will be exposed through an npm command and will be safe to run repeatedly. It will not edit the Cocos engine, game scene, or runtime resource bundle. The loading images must stay in the WeChat main package because they are needed before the resource subpackage becomes available.

The existing build verifier will be extended to confirm that the customization has been applied and that Cocos branding assets are no longer present. This protects against publishing a fresh build without running the customization step.

## Loading Flow

```text
WeChat starts game.js
        ↓
custom first screen appears immediately
        ↓
Cocos reports engine/application progress
        ↓
coral progress bar advances
        ↓
first screen ends and the Cat 2048 start scene appears
```

The progress values remain driven by the existing Cocos startup promises. No artificial delay is added; if the game initializes quickly, the loading page may only be visible briefly.

## Failure Handling

- If no WeChat build exists, the customization command stops and tells the developer to build with Cocos Creator first.
- If Cocos changes the generated first-screen structure, the script stops instead of partially modifying the build.
- If a loading asset is missing, the script stops before changing the generated files.
- The build verifier rejects builds that still use the default Cocos loading assets or that omit the customization marker.

## Verification

1. Test the customization logic against a temporary fixture copied from the generated Cocos first-screen files.
2. Run the customization command twice and confirm the second run succeeds without duplicating or corrupting changes.
3. Run the existing TypeScript and Vitest suites.
4. Run the WeChat build verifier and confirm the main package remains below 4 MB.
5. Open the resulting build in WeChat Developer Tools and confirm the custom loading screen is the first visible game content, remains centered in portrait mode, shows progress, and transitions to the start scene without a black or Cocos-branded flash.

## Acceptance Criteria

- Cocos branding never appears during a normal fresh launch of the customized WeChat build.
- The first visible game-owned screen uses the warm ivory Cat 2048 design, cat artwork, `猫咪 2048` title, and progress indicator.
- The loading layout is centered and undistorted on portrait phone screens.
- The loading screen disappears as soon as the application is ready; it does not add a fixed delay.
- Rebuilding and rerunning the documented customization command reliably reproduces the result.
- The verifier fails if customization is skipped.
- The WeChat main package remains below 4 MB and existing automated checks continue to pass.
