# Startup Resource Barrier Design

**Date:** 2026-07-31

**Status:** Approved in conversation, pending written review

## Goal

Keep a visually continuous loading experience until every runtime asset under
`assets/resources/game` is loaded, then render the home screen once with no
missing or late-appearing images. The WeChat first screen must use
`assets/resources/game/branding/logo.png` instead of the generated Cocos logo.

## Root Cause

The generated WeChat first screen ends before `application.start()`. The main
scene then calls `showHome()` before `ArtRepository.preload()` resolves, so the
first home render reads an empty art cache. A second render after preload makes
the missing images appear late.

The source-controlled loading customizer already names the requested branding
logo, but the current generated build contains a different `logo.png`. This
means the post-build customization was not applied after the latest build.

## Design

The generated first screen remains responsible for engine startup and uses the
project branding logo copied by `tools/customize_wechat_loading.mjs`. When the
main scene starts, it immediately displays a lightweight Cocos loading view
that matches the first screen's warm background and progress treatment.

`ArtRepository` loads the complete `resources/game` directory and reports
progress. After that barrier succeeds, it populates its sprite, font, and audio
caches. `Cat2048Boot` then installs the runtime fonts, removes the loading view,
and builds the home screen for the first time. It must never call `showHome()`
before the resource barrier resolves.

The post-build customization command must copy
`game/assets/resources/game/branding/logo.png` to the generated WeChat
`logo.png`. Verification must compare the two files so a stale or default logo
cannot pass release checks.

## Loading Flow

```text
WeChat first screen with branding/logo.png
  -> application starts
  -> matching scene loading view appears
  -> resources/game loads to completion
  -> repository caches required assets
  -> runtime fonts are installed
  -> home screen is built once
```

## Failure Handling

Required image or font failures keep the user off the home screen and replace
the progress label with a concise load-failure state. Optional audio failures
remain non-blocking. The app must not render a partially populated home screen.

## Verification

- A startup-order test proves `showHome()` is not reached before preload.
- Repository tests cover complete-directory progress and required-asset errors.
- The WeChat build verifier rejects a generated logo whose bytes differ from
  `assets/resources/game/branding/logo.png`.
- A fresh launch in WeChat Developer Tools confirms visual continuity and no
  late image appearance.

## Acceptance Criteria

- The first-screen logo is the provided Cat 2048 branding image.
- All `resources/game` assets finish loading before the home screen appears.
- The home screen is built once and never displays missing images.
- Loading failures do not expose a partial home screen.
- A new WeChat build cannot pass verification until the loading customization
  has been reapplied.
