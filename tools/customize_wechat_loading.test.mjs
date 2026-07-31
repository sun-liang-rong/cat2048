import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { customizeFirstScreen, filesHaveSameBytes } from './customize_wechat_loading.mjs';

test('customizeFirstScreen replaces default colors and is idempotent', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cat2048-loading-'));
  const firstScreen = join(directory, 'first-screen.js');
  writeFileSync(firstScreen, [
    'let progressBarColor = [61 / 255, 197 / 255, 222 / 255, 1];',
    'let progressBackground = [100 / 255, 111 / 255, 118 / 255, 1];',
    'let bgColor = [0.01568627450980392,0.03529411764705882,0.0392156862745098,0.00392156862745098];',
  ].join('\n'));

  customizeFirstScreen(firstScreen);
  customizeFirstScreen(firstScreen);

  const output = readFileSync(firstScreen, 'utf8');
  assert.match(output, /CAT2048_CUSTOM_LOADING_SCREEN/);
  assert.match(output, /let progressBarColor = \[0\.92, 0\.31, 0\.23, 1\];/);
  assert.match(output, /let progressBackground = \[0\.16, 0\.13, 0\.11, 1\];/);
  assert.match(output, /let bgColor = \[1, 0\.94, 0\.83, 1\];/);
  assert.equal((output.match(/CAT2048_CUSTOM_LOADING_SCREEN/g) ?? []).length, 1);
});

test('filesHaveSameBytes detects stale generated logos', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cat2048-logo-'));
  const source = join(directory, 'source.png');
  const generated = join(directory, 'generated.png');
  writeFileSync(source, Buffer.from([1, 2, 3]));
  writeFileSync(generated, Buffer.from([1, 2, 3]));

  assert.equal(filesHaveSameBytes(source, generated), true);
  writeFileSync(generated, Buffer.from([3, 2, 1]));
  assert.equal(filesHaveSameBytes(source, generated), false);
});
