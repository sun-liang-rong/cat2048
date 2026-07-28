# WeChat Resource Subpackage Design

**Date:** 2026-07-28

**Status:** Approved for implementation planning

## Goal

Keep the Cat 2048 WeChat mini-game main package below the 4 MB upload limit without requiring a CDN or changing runtime asset paths.

## Evidence

The runtime assets under `game/assets/resources` total approximately 5.58 MB. The three background images account for approximately 4.16 MB. The existing WeChat build profile already enables a subpackage for the main scene bundle and separates the engine, but the built-in `resources` Asset Bundle still uses its default local compression mode. As a result, its assets remain in the mini-game main package.

A later PNG-to-WebP migration reduced the package size but failed at runtime in WeChat Developer Tools 2.01.2510290 with base library 3.16.2. Cocos emitted each WebP file and referenced the correct UUID, but the WeChat virtual package file system returned `file ...webp does not exist` from `fs.access`. The failure happens before image decoding, so WebP cannot be used as a reliable local package format for this project.

## Design

Configure the built-in `resources` Asset Bundle to use the `subpackage` compression type for the WeChat mini-game target while keeping it local rather than remote.

Restore the runtime images to PNG with valid Cocos metadata. Configure the Cocos directory metadata for `game/assets/resources` so Cocos Creator generates the corresponding WeChat subpackage declaration and places the `resources` bundle under the build output's `subpackages` directory. Existing calls to `resources.load(...)`, logical asset paths, and scene code remain unchanged.

No CDN, download server, or custom bundle loader is introduced. Image compression is outside this change because subpackaging directly addresses the upload-limit boundary while preserving current image quality.

## Failure Handling

If Cocos Creator does not emit the `resources` subpackage, inspect the generated `game.json` and bundle output before making further changes. Do not compensate by deleting assets or changing runtime paths.

If the generated resources subpackage exceeds the platform's per-subpackage limit, split the backgrounds into a separate custom Asset Bundle as a follow-up. Current source sizes are below that threshold, so this is not part of the initial implementation.

If a future image-format optimization is required, verify that the candidate extension is present in the WeChat virtual package before migrating the source assets. Renaming encoded WebP data to a PNG extension is not an accepted fallback.

## Verification

1. Build the project for WeChat Mini Game with Cocos Creator 3.8.8.
2. Confirm `game.json` declares the generated resource subpackage.
3. Confirm the generated resource files are under a subpackage rather than the main package asset directory.
4. Confirm the built runtime image assets use PNG rather than WebP.
5. Measure the main package using the same file-counting rules as WeChat Developer Tools and require it to be below 4 MB.
6. Run the existing automated verification suite, including checks for matching image metadata and generated subpackage contents.
7. Clear the WeChat Developer Tools cache, launch the fresh build, and confirm the home background, board background, cat sprites, UI sprites, and audio load without file-system errors.

## Acceptance Criteria

- The WeChat main package is below 4 MB.
- The `resources` Asset Bundle is emitted as a local WeChat subpackage.
- Runtime images use PNG and every image has matching Cocos metadata.
- No `file assets/resources/native/... does not exist` error is emitted.
- No remote server is required.
- Existing resource loading code and logical asset paths are unchanged.
- Existing automated tests pass and the built game loads its runtime resources.
