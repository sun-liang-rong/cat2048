# WeChat Main Package Size Optimization Design

**Date:** 2026-07-28

**Status:** Approved

## Goal

Reduce the Cat 2048 WeChat mini-game main package to no more than 4 MiB
(4,194,304 bytes) while keeping all runtime assets local and preserving the
current game behavior and image quality.

## Baseline

The current `game/build/wechatgame-001` output contains 111 files totaling
6,068,515 bytes. Its largest groups are:

- `cocos-js`: 3,712,552 bytes, including Bullet and Spine runtime files even
  though the project does not use physics or Spine.
- `assets`: 2,165,476 bytes, including 1,440,588 bytes in the built-in
  `resources` Asset Bundle.
- Adapter, bootstrap, configuration, and branding files: approximately
  190 KiB.

The source metadata marks `assets/resources` as a local WeChat subpackage, but
the measured build does not declare any subpackages. The last recorded editor
build also used `merge_dep` for the main bundle and inherited physics settings,
so the source intent and generated output are not aligned.

## Design

### Bundle Layout

Keep the start scene, game scripts, and their direct dependencies in the main
package. Keep the main bundle compression type as `merge_dep` so the game can
start without loading a scene subpackage.

Emit the built-in `resources` Asset Bundle as a local WeChat subpackage. Keep
the existing `resources.load(...)` calls and logical asset paths unchanged.
Images and audio remain local; no CDN, remote bundle, or custom download layer
is introduced.

Store the required bundle and build options in reproducible project build
configuration rather than relying on transient editor UI state. A fresh Cocos
Creator 3.8.8 build must reproduce the same package layout.

### Engine Modules

Build a project-specific Cocos engine containing only the features used by the
game. Preserve the modules required for scenes, nodes, UI, sprites, textures,
audio, input, tweening or animation used by the current presentation code, and
local persistence.

Disable confirmed unused modules, including 3D physics, 2D physics, Spine,
DragonBones, and WebGL2 support. The generated package must not contain Bullet
or Spine WASM loaders or binaries. Additional modules may be disabled only
after checking both source imports and scene dependencies.

Do not enable the WeChat engine plugin in this change. Engine separation is a
fallback that requires a separate compatibility decision if local module
trimming cannot meet the size target.

### Runtime Flow

The game starts from the main package as it does today. Cocos loads the local
`resources` subpackage through its generated bundle integration when the game
requests runtime art or audio. Existing gameplay and resource repository code
do not change.

The first resource request may include the local subpackage initialization
cost, but it must not require network access. Missing subpackage declarations,
missing files, or unexpected remote URLs are build failures rather than
conditions handled by new runtime fallback code.

## Failure Handling

If Cocos does not emit the `resources` subpackage, fail verification and report
the generated `game.json` and asset locations. Refresh or reimport the bundle
metadata and correct the recorded build configuration before rebuilding; do
not compensate by changing runtime paths.

If the main package remains above 4 MiB, report its largest files and review
additional engine modules that are demonstrably unused. Do not reduce image
quality, change image formats, enable a CDN, or enable the WeChat engine plugin
without a new explicit decision.

If a cold launch reports missing files, reject the build even when its size is
within the limit. Package size is not allowed to trade off runtime integrity.

## Verification

1. Add source-level checks for the local `resources` subpackage configuration
   and the intended engine module exclusions.
2. Build the project for WeChat Mini Game with Cocos Creator 3.8.8 using the
   recorded configuration.
3. Parse the generated `game.json` and require a local `resources` subpackage.
4. Require runtime PNG and audio files to be inside the declared subpackage and
   absent from the main package asset tree.
5. Reject Bullet, Spine, and other disabled-module runtime artifacts.
6. Count all generated files outside declared subpackage roots and require the
   total to be at most 4,194,304 bytes.
7. Run the existing TypeScript checks and Vitest suite.
8. Clear the WeChat Developer Tools cache and perform a cold launch. Verify the
   home background, board background, cat sprites, UI sprites, input, local
   storage, and audio without file-system or bundle-loading errors.

## Acceptance Criteria

- The measured WeChat main package is at most 4 MiB (4,194,304 bytes).
- `resources` is emitted as a local subpackage and is declared in `game.json`.
- Runtime assets remain local PNG and audio files with unchanged visual and
  audio quality.
- The game uses no CDN, remote Asset Bundle, or WeChat engine plugin.
- Bullet, Spine, and other confirmed unused engine artifacts are absent.
- Existing resource paths and gameplay behavior are unchanged.
- Automated verification passes, and a cache-cleared WeChat Developer Tools
  launch loads all required assets without errors.

## Non-Goals

- Reducing the combined size of the main package and all subpackages.
- Re-encoding or visually degrading runtime images.
- Refactoring gameplay or presentation code unrelated to engine dependencies.
- Introducing remote delivery or a custom asset-loading system.
