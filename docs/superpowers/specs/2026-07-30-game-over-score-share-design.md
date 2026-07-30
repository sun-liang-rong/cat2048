# Game-over score sharing design

## Goal

At game over, let the player share a generated score card containing the current score and the highest-level cat to a WeChat friend or group.

## Experience

- The game-over dialog keeps the existing home and replay actions and adds a prominent `分享战绩` action with the existing share icon.
- The shared 1000 x 800 image uses the existing score-card background, the highest-level cat remaining on the board, the current score, the saved high score, and a short challenge line.
- Tapping share opens WeChat's native share picker through `wx.shareAppMessage`; no score or player data is uploaded.
- Browser preview and unavailable platform APIs show a short in-game notice. Cancellation or failure does not change game state.

## Architecture

`ResultShareController` owns platform detection, canvas composition, temporary image export, and WeChat invocation. It has no Cocos dependency and accepts a narrow runtime interface so Vitest can cover it. `ArtRepository` exposes the native image locations already loaded by Cocos. `Cat2048Boot` calculates the highest cat and connects the game-over dialog to the controller.

## Error handling and tests

The controller returns `shared`, `unsupported`, or `failed`. Callers show a notice for the latter two outcomes and leave gameplay data untouched. Tests cover successful card generation, missing WeChat APIs, and image/export failure; the project verification command covers asset preparation and TypeScript regressions.
