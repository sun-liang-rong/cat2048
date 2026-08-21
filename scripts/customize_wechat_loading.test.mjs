import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { patchWeChatBootstrap } from './customize_wechat_loading.mjs';

const firstScreenFixture = [
  'let progressBarColor = [61 / 255, 197 / 255, 222 / 255, 1];',
  'let progressBackground = [100 / 255, 111 / 255, 118 / 255, 1];',
  'let bgColor = [0.01, 0.02, 0.03, 1];',
].join('\n');

const gameFixture = [
  "const firstScreen = require('./first-screen');",
  '',
  "firstScreen.start('default', 'default', 'false').then(() => {",
  "    return System.import('./application.js');",
  '}).then((module) => {',
  '    return firstScreen.setProgress(0.2).then(() => Promise.resolve(module));',
  '}).then(({ Application }) => {',
  '    return new Application();',
  '}).then((application) => {',
  '    return firstScreen.setProgress(0.4).then(() => Promise.resolve(application));',
  '}).then((application) => {',
  '    return onApplicationCreated(application);',
  '});',
  'function onApplicationCreated(application) {',
  "    return System.import('cc').then((module) => {",
  '        return firstScreen.setProgress(0.6).then(() => Promise.resolve(module));',
  '    }).then((cc) => {',
  "        require('./engine-adapter');",
  '        return application.init(cc);',
  '    }).then(() => {',
  '        return firstScreen.end().then(() => application.start());',
  '    });',
  '}',
].join('\n');

test('patchWeChatBootstrap holds the Cocos first screen until runtime readiness', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cat2048-loading-'));
  const gamePath = join(directory, 'game.js');
  writeFileSync(gamePath, gameFixture);
  writeFileSync(join(directory, 'first-screen.js'), firstScreenFixture);

  assert.equal(patchWeChatBootstrap(directory), true);
  assert.equal(patchWeChatBootstrap(directory), false);

  const output = readFileSync(gamePath, 'utf8');
  assert.equal((output.match(/CAT2048_COCOS_LOADING_BRIDGE/g) ?? []).length, 1);
  assert.match(output, /globalThis\.__cat2048CocosLoading/);
  assert.match(output, /runtimeReady\.then\(\(\) => firstScreen\.end\(\)\)/);
  assert.doesNotMatch(output, /firstScreen\.end\(\)\.then\(\(\) => application\.start\(\)\)/);

  const firstScreen = readFileSync(join(directory, 'first-screen.js'), 'utf8');
  assert.equal((firstScreen.match(/CAT2048_COCOS_LOADING_THEME/g) ?? []).length, 1);
  assert.match(firstScreen, /239 \/ 255, 100 \/ 255, 83 \/ 255/);
  assert.match(firstScreen, /255 \/ 255, 244 \/ 255, 222 \/ 255/);
});

test('patchWeChatBootstrap rejects unsupported generated bootstraps before writing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cat2048-loading-'));
  const gamePath = join(directory, 'game.js');
  writeFileSync(gamePath, 'const firstScreen = require(\'./first-screen\');');
  writeFileSync(join(directory, 'first-screen.js'), firstScreenFixture);

  assert.throws(() => patchWeChatBootstrap(directory), /missing first-screen end chain/);
  assert.equal(readFileSync(gamePath, 'utf8'), "const firstScreen = require('./first-screen');");
});
