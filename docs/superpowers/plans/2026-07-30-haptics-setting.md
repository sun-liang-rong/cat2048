# Haptics Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a default-on vibration switch to the existing settings popup and persist the preference without resetting legacy saves.

**Architecture:** Normalize legacy V1 saves at the storage boundary by adding `hapticsEnabled: true`, expose an enable flag on `HapticController`, and build a reusable Cocos toggle control for the settings popup. `Cat2048Boot` owns preference synchronization between storage, audio, haptics, and the visible controls.

**Tech Stack:** TypeScript, Cocos Creator 3.8.8, Vitest 2

---

### Task 1: Persist and migrate the vibration preference

**Files:**
- Modify: `game/tests/storage.test.ts`
- Modify: `game/assets/scripts/infrastructure/storage.ts`

- [ ] **Step 1: Write failing storage tests**

Update the expected save shape and add a legacy migration case:

```ts
it('loads complete V1 data', () => {
  const memory = new MemoryStorage();
  memory.setItem(SAVE_KEY, JSON.stringify({
    schemaVersion: 1,
    highScore: 512,
    soundEnabled: false,
    hapticsEnabled: false,
  }));
  expect(new LocalGameStorage(memory).load()).toEqual({
    schemaVersion: 1,
    highScore: 512,
    soundEnabled: false,
    hapticsEnabled: false,
  });
});

it('enables haptics while preserving legacy V1 save values', () => {
  const memory = new MemoryStorage();
  memory.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 1, highScore: 256, soundEnabled: false }));

  expect(new LocalGameStorage(memory).load()).toEqual({
    schemaVersion: 1,
    highScore: 256,
    soundEnabled: false,
    hapticsEnabled: true,
  });
  expect(JSON.parse(memory.getItem(SAVE_KEY)!)).toEqual({
    schemaVersion: 1,
    highScore: 256,
    soundEnabled: false,
    hapticsEnabled: true,
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- storage.test.ts` from `game`.

Expected: FAIL because loaded/default saves do not contain `hapticsEnabled`.

- [ ] **Step 3: Normalize legacy saves**

Add the required field and default:

```ts
export interface SaveDataV1 {
  readonly schemaVersion: 1;
  readonly highScore: number;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
}

export const DEFAULT_SAVE: SaveDataV1 = {
  schemaVersion: 1,
  highScore: 0,
  soundEnabled: true,
  hapticsEnabled: true,
};
```

In `load()`, validate the existing base fields, accept only `undefined` or a boolean for `hapticsEnabled`, normalize `undefined` to `true`, and persist the normalized value. Keep `save()` strict so runtime calls missing the field remain malformed.

- [ ] **Step 4: Run storage tests and verify GREEN**

Run: `npm test -- storage.test.ts` from `game`.

Expected: all storage tests PASS.

### Task 2: Make haptic output switchable

**Files:**
- Modify: `game/tests/haptics.test.ts`
- Modify: `game/assets/scripts/infrastructure/HapticController.ts`

- [ ] **Step 1: Write the failing controller test**

```ts
it('suppresses vibration while disabled and resumes after re-enabling', () => {
  const vibrateShort = vi.fn();
  const haptics = new HapticController({ wx: { vibrateShort } });

  haptics.enabled = false;
  haptics.light();
  expect(vibrateShort).not.toHaveBeenCalled();

  haptics.enabled = true;
  haptics.light();
  expect(vibrateShort).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- haptics.test.ts` from `game`.

Expected: FAIL because `HapticController` has no `enabled` behavior.

- [ ] **Step 3: Add the minimal enable guard**

```ts
export class HapticController {
  public enabled = true;

  public light(): void {
    if (!this.enabled) return;
    // Existing platform fallback logic remains unchanged.
  }
}
```

- [ ] **Step 4: Run haptic tests and verify GREEN**

Run: `npm test -- haptics.test.ts` from `game`.

Expected: all haptic tests PASS.

### Task 3: Add both switches to the settings popup

**Files:**
- Modify: `game/assets/scripts/presentation/uiFactory.ts`
- Modify: `game/assets/scripts/presentation/Cat2048Boot.ts`

- [ ] **Step 1: Add a reusable switch control**

Export `createToggle(name, enabled, onChange)` from `uiFactory.ts`. Draw a stable `110 x 58` rounded track using teal when enabled and cream when disabled, place a `46 x 46` ivory knob at `x = 25` or `x = -25`, and animate the knob when the node receives `TOUCH_END`. The callback receives the new boolean state.

```ts
export function createToggle(name: string, enabled: boolean, onChange: (enabled: boolean) => void): Node {
  const node = createUiNode(`${name}:${enabled ? 'On' : 'Off'}`, 110, 58);
  let current = enabled;
  const knob = createUiNode(`${name}:Knob`, 46, 46);
  node.addChild(knob);

  const render = (): void => {
    drawRounded(node, 110, 58, current ? COLORS.teal : COLORS.cream, 29,
      { color: COLORS.ink, width: 4 });
    drawRounded(knob, 46, 46, COLORS.ivory, 23, { color: COLORS.ink, width: 3 });
    tween(knob).to(0.12, { position: new Vec3(current ? 25 : -25, 0, 0) }, { easing: 'quadOut' }).start();
  };

  render();
  node.on(Node.EventType.TOUCH_END, () => {
    current = !current;
    render();
    onChange(current);
  });
  return node;
}
```

- [ ] **Step 2: Synchronize loaded haptic state**

Initialize the component save with `hapticsEnabled: true`, then add this after storage loads:

```ts
this.haptics.enabled = this.save.hapticsEnabled;
```

- [ ] **Step 3: Replace the one-action settings dialog**

Rewrite `showSettingsDialog()` as a dedicated overlay using the existing `DialogOverlay` and `DialogPanel` visual language. Add two unframed rows labeled `音效` and `震动`, each with a state label and `createToggle`. Each callback updates `this.save`, persists it immediately, and synchronizes `this.audio.enabled` or `this.haptics.enabled`. Keep the close icon and one bottom `关闭` button; closing rebuilds the home screen so the sound shortcut reflects any change.

- [ ] **Step 4: Run automated verification**

Run from `game`:

```powershell
npm run typecheck:core
npm test
```

Expected: TypeScript exits 0 and all Vitest suites PASS.

- [ ] **Step 5: Verify the complete project**

Run: `npm run verify` from `game`.

Expected: asset preparation, core typecheck, and all tests exit 0. Then inspect `git diff --check` and confirm only the planned files changed.
