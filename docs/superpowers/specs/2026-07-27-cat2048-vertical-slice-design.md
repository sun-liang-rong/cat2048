# Cat 2048 Vertical Slice Design

**Date:** 2026-07-27

**Status:** Approved for implementation planning

## 1. Goal

Build a polished, playable vertical slice of Cat 2048 with Cocos Creator 3.8.8 and TypeScript. The slice includes a portrait home scene, classic endless 2048 gameplay, score and high-score handling, essential game feedback, restart and exit flows, sound control, and local persistence.

The slice must run in Cocos browser preview and in the WeChat Developer Tools. It does not integrate WeChat platform services.

## 2. Scope

### Included

- A `750 x 1334` portrait-only layout with safe-area handling.
- A home scene with the game title, high score, classic-mode entry, and sound toggle.
- A game scene with a `4 x 4` board, score, high score, back action, and restart action.
- Swipe input in four cardinal directions.
- Standard 2048 compression and merge behavior using cat levels `Lv1` through `Lv9`.
- A fixed cat evolution chain and score formula `2^level` for the newly created tile.
- Initial placement of two randomly generated cats.
- One random cat after each effective move: `90% Lv1`, `10% Lv2`.
- Movement, merge, spawn, and game-over feedback.
- A game-over dialog with final score, high score, restart, and home actions.
- Confirmation dialogs before abandoning or restarting an active game.
- Local persistence for high score and sound preference.
- Automated core tests and browser-build smoke tests.
- Processing the generated art into runtime-ready Cocos assets.

### Deferred

- Revive, undo, refresh, shuffle, and erase items.
- Challenge mode, collection, tasks, achievements, shop, cosmetics, and skin selection.
- Resume of an unfinished board.
- Rewarded ads, interstitial ads, sharing, cloud storage, user profile, and friend leaderboard.
- Landscape layout.
- `sheet_brand.png` and `bg_board_pink.png`, which are absent from the current generated asset set.

Deferred systems will not have empty managers or placeholder screens in this slice.

## 3. Repository Layout

The Cocos project lives under `game/` rather than at the repository root. This prevents Cocos Creator from importing the art-generation sources, response records, and large source images already stored under the root `assets/` directory.

```text
cat2048/
  assets/art-generation/       # Source art and generation records
  docs/superpowers/specs/      # Approved design documents
  game/                        # Cocos Creator 3.8.8 project
    assets/
      game/                    # Processed runtime art and audio
      scenes/                  # Home and gameplay scenes
      scripts/
        core/                  # Engine-independent 2048 rules
        presentation/          # Cocos components and animation
        infrastructure/        # Storage, random source, config loading
    tests/                     # Engine-independent tests
  tools/                       # Project-specific asset preparation
```

Only processed outputs are copied into `game/assets/game/`. Source sheets, `_source` images, generation responses, and unused backgrounds must not enter the Cocos project.

## 4. Architecture

The implementation uses three dependency layers.

### 4.1 Pure TypeScript Core

The core owns the rules and has no dependency on `cc`, browser APIs, storage APIs, or scene nodes. It is based on the behavior of the MIT-licensed original 2048 implementation. The implementation plan must preserve the relevant license and attribution in `game/THIRD_PARTY_NOTICES.md`.

Primary responsibilities:

- `Game2048`: starts games, accepts moves, tracks score, and reports running or game-over status.
- `Board`: owns the `4 x 4` grid, compression, merging, empty-cell lookup, spawning, and legal-move detection.
- `MoveResult`: describes all movements, merges, score changes, the spawned tile, and the resulting immutable snapshot.
- `RandomSource`: injectable random-number interface used for level selection and empty-cell selection.

A tile has a stable runtime ID and a level from `1` through `9`. Stable IDs let the presentation layer animate a tile from its previous cell to its next cell without comparing node order.

The public move operation has this conceptual contract:

```ts
move(direction: Direction): MoveResult
```

`MoveResult.changed` is false for an ineffective swipe. In that case, the board, score, random source, and rendered nodes remain unchanged. For an effective swipe, the result contains motion and merge records, a score delta, one spawn record, the next snapshot, and the resulting game status.

### 4.2 Cocos Presentation

The presentation layer translates user input into core commands and renders `MoveResult` values.

- `HomeScene`: shows title, high score, classic-mode entry, and sound state.
- `GameScene`: coordinates the current game, HUD, dialogs, scene navigation, and input lock.
- `SwipeInput`: recognizes one-finger gestures, chooses the dominant axis, and emits one direction after a minimum travel threshold.
- `BoardView`: maps stable tile IDs to pooled Cocos nodes and plays movement, merge, and spawn sequences.
- `DialogView`: handles game-over, restart confirmation, and home confirmation without containing game rules.
- `AudioController`: plays optional feedback and exposes a persisted sound toggle.

The presentation layer may call the core and infrastructure ports. The core never calls the presentation layer.

### 4.3 Infrastructure

- `LocalGameStorage`: loads and saves a versioned data object.
- `RuntimeRandomSource`: supplies production randomness.
- `GameConfig`: defines board size, score rules, spawn weights, levels, display names, and runtime sprite paths.

The persisted object is limited to:

```ts
interface SaveDataV1 {
  schemaVersion: 1;
  highScore: number;
  soundEnabled: boolean;
}
```

No WeChat adapter is created in this slice. Future platform support can implement the storage or social ports when a real consumer exists.

## 5. Game Rules

1. A new game starts with an empty board and spawns two cats using the configured spawn weights.
2. A swipe compresses all tiles toward the chosen edge.
3. Adjacent tiles of the same level merge once per move into the next level.
4. A newly merged tile cannot merge again during the same move.
5. `Lv9` is terminal and cannot merge further.
6. Each merge adds `2^newLevel` points.
7. An effective move spawns exactly one new tile in a randomly chosen empty cell after all merges complete.
8. An ineffective move does not spawn a tile, consume randomness, change score, or trigger board animation.
9. The game ends only when the board has no empty cells and no horizontally or vertically adjacent equal-level pair.
10. High score updates after a stable effective move and again before showing game over.

The fixed level chain is:

| Level | Cat | Runtime asset |
| --- | --- | --- |
| 1 | Orange tabby | `cat_01` |
| 2 | Blue-and-white British Shorthair | `cat_02` |
| 3 | Calico | `cat_03` |
| 4 | Ragdoll | `cat_04` |
| 5 | Siamese | `cat_05` |
| 6 | American Shorthair tabby | `cat_06` |
| 7 | Tuxedo cat | `cat_07` |
| 8 | Black Bombay | `cat_08` |
| 9 | Galaxy aurora cat | `cat_09` |

## 6. Scene And Interaction Design

### Home Scene

The title occupies the upper visual area over `bg_home`. The high-score block appears below it, followed by one primary classic-mode button. The sound toggle sits in the lower safe area. Deferred feature entrances are not shown.

Because `sheet_brand.png` is missing, the slice uses programmatic title text over a simple decorative asset. This is an explicit first-release choice, not a temporary broken state.

### Game Scene

The top row contains back, current score, high score, and restart. The square board uses almost the full available width below the safe area. The lower portion remains visually quiet and absorbs device-bottom safe-area differences.

The board is dimensionally stable. Tile labels, effects, and dynamic score text cannot resize the board or its grid tracks.

Back and restart open confirmation dialogs while a game is active. After game over, the dialog offers restart and home directly.

### Input And Animation

The gesture component accepts one active pointer and emits only one direction per completed gesture. It ignores short taps and chooses horizontal or vertical direction by the dominant delta.

During an effective move, input remains locked until the visual sequence completes:

1. Tile movement.
2. Merge scale and the configured `0.2s` sparkle effect.
3. New-tile appearance.
4. HUD update and input unlock.

An ineffective swipe returns immediately without locking input for an animation cycle.

If a scene exits during an animation, the animation sequence is canceled and its input lock is released as part of scene cleanup.

## 7. Asset Pipeline

The asset-preparation stage is a required prerequisite for scene assembly.

- Validate the root manifest and verify required input files and dimensions.
- Slice `sheet_cats` into nine cat sprites.
- Slice the gameplay and UI sheets used by the vertical slice.
- Remove the chroma-key background with edge cleanup and verify meaningful alpha.
- Keep transparent sprites as PNG.
- Compress opaque home and wood-board backgrounds for runtime use while preserving acceptable visual quality.
- Generate a machine-readable mapping from logical asset IDs to Cocos paths.
- Reject duplicate IDs, missing outputs, unexpected dimensions, opaque sprite backgrounds, and visible chroma spill.

The initial asset gate uses `bg_home`, `bg_board_wood`, `sheet_cats`, the relevant cells from `sheet_gameplay`, `sheet_utility`, and `sheet_ui_kit`. Other generated sheets remain source material for later milestones.

## 8. Error Handling

- Missing required runtime art or an invalid asset mapping fails validation before scene work proceeds.
- Development builds log an explicit asset ID and path when a runtime load fails.
- A missing or failed audio asset disables that sound and does not block gameplay.
- Missing, malformed, or unsupported save data falls back to `{ schemaVersion: 1, highScore: 0, soundEnabled: true }` and attempts to write the repaired value.
- A failed save logs the error but does not interrupt the current game.
- Core commands reject invalid directions or malformed snapshots during development rather than producing a partially mutated board.
- Scene cleanup cancels pending tweens and releases input state to prevent callbacks from touching destroyed nodes.

## 9. Testing Strategy

### Core Unit Tests

Vitest runs without Cocos and covers:

- Compression in all four directions.
- Two-tile, three-tile, and four-tile merge cases.
- The rule that a merged tile cannot merge again in the same move.
- Multiple independent merges in one row or column.
- Score deltas for every mergeable level.
- `Lv9` terminal behavior.
- Effective and ineffective moves.
- Deterministic initial and post-move spawning through a fixed random source.
- Game-over and still-playable full-board cases.
- Input board immutability and stable tile IDs in results.

Tests use fixed random sequences. They do not assert observed probabilities over repeated random trials.

### Storage Tests

Tests cover missing data, valid V1 data, malformed JSON, wrong property types, and unsupported schema versions. Each invalid case must return safe defaults without throwing into scene code.

### Build And Browser Tests

A browser build must pass a Playwright smoke flow:

1. The canvas contains non-background pixels.
2. Home title, high score, and classic-mode entry are visible.
3. Starting classic mode shows a complete `4 x 4` board with two cats.
4. A swipe changes a deterministic fixture board as expected.
5. Restart and home confirmations can be canceled and confirmed.
6. A forced terminal board shows the game-over dialog.

Visual checks run at representative portrait viewports, including `375 x 667` and `390 x 844`. Screenshots and canvas-pixel checks verify that the board is fully framed, text remains inside controls, touch targets do not overlap, and the canvas is not blank.

### Manual WeChat Check

The same build is opened in WeChat Developer Tools in portrait mode. Acceptance requires successful launch, touch swipes, sound toggle persistence, restart, game over, and return to home. No WeChat API behavior is part of this milestone.

## 10. Acceptance Criteria

The vertical slice is complete when:

- It opens as a Cocos Creator 3.8.8 project under `game/` without importing source-generation artifacts.
- Home and classic gameplay match the approved portrait hierarchy.
- All specified core rules pass deterministic tests.
- A complete game can be played from home through game over and restart.
- High score and sound preference survive a reload.
- Required runtime art is processed, mapped, and validated automatically.
- Browser smoke tests and portrait visual checks pass.
- The project runs in WeChat Developer Tools without relying on ads, sharing, cloud storage, profile APIs, or leaderboards.
