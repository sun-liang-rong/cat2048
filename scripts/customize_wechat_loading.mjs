import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedBuild = join(root, 'packages', 'game', 'build', 'wechatgame');
const marker = 'CAT2048_COCOS_LOADING_BRIDGE';
const themeMarker = 'CAT2048_COCOS_LOADING_THEME';

const bridgeSource = `// ${marker}
const runtimeReady = new Promise((resolve) => {
    let ready = false;
    globalThis.__cat2048CocosLoading = {
        setProgress: (ratio) => {
            const normalized = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
            void firstScreen.setProgress(0.6 + normalized * 0.39);
        },
        markReady: () => {
            if (ready) return;
            ready = true;
            resolve();
        },
        markError: (error) => {
            console.error('[Cat2048] Runtime asset loading failed', error);
        },
    };
});`;

const applicationStart = `    }).then(() => {
        return firstScreen.end().then(() => application.start());
    });`;
const bridgedApplicationStart = `    }).then(() => {
        return application.start();
    }).then(() => {
        return runtimeReady.then(() => firstScreen.end());
    });`;

const normalizeNewlines = (source) => source.replace(/\r\n/g, '\n');

const restoreNewlines = (source, newline) => source.replace(/\n/g, newline);

const themeFirstScreen = (original) => {
  if (original.includes(themeMarker)) return original;

  const progressAnchor = 'let progressBarColor = [61 / 255, 197 / 255, 222 / 255, 1];';
  const trackAnchor = 'let progressBackground = [100 / 255, 111 / 255, 118 / 255, 1];';
  const backgroundPattern = /let bgColor = \[[^\n]+\];/;
  if (!original.includes(progressAnchor) || !original.includes(trackAnchor)
    || !backgroundPattern.test(original)) {
    throw new Error('Unsupported Cocos first-screen template: missing color palette');
  }

  return original
    .replace(progressAnchor,
      `// ${themeMarker}\nlet progressBarColor = [239 / 255, 100 / 255, 83 / 255, 1];`)
    .replace(trackAnchor,
      'let progressBackground = [221 / 255, 190 / 255, 157 / 255, 1];')
    .replace(backgroundPattern,
      'let bgColor = [255 / 255, 244 / 255, 222 / 255, 1];');
};

export const patchWeChatBootstrap = (buildDirectory = generatedBuild) => {
  const gamePath = join(buildDirectory, 'game.js');
  const firstScreenPath = join(buildDirectory, 'first-screen.js');

  if (!existsSync(gamePath)) {
    throw new Error(`Required WeChat bootstrap is missing: ${gamePath}`);
  }
  if (!existsSync(firstScreenPath)) {
    throw new Error(`Required Cocos first screen is missing: ${firstScreenPath}`);
  }

  const original = readFileSync(gamePath, 'utf8');
  const firstScreenOriginal = readFileSync(firstScreenPath, 'utf8');
  let output = original;

  if (!original.includes(marker)) {
    const newline = original.includes('\r\n') ? '\r\n' : '\n';
    const source = normalizeNewlines(original);
    const requireAnchor = "const firstScreen = require('./first-screen');";

    if (!source.includes(requireAnchor)) {
      throw new Error('Unsupported Cocos game.js template: missing first-screen import');
    }
    if (!source.includes(applicationStart)) {
      throw new Error('Unsupported Cocos game.js template: missing first-screen end chain');
    }

    output = restoreNewlines(source
      .replace(requireAnchor, `${requireAnchor}\n${bridgeSource}`)
      .replace(applicationStart, bridgedApplicationStart), newline);
  }

  const themedFirstScreen = themeFirstScreen(firstScreenOriginal);
  const gameChanged = output !== original;
  const firstScreenChanged = themedFirstScreen !== firstScreenOriginal;
  if (gameChanged) writeFileSync(gamePath, output);
  if (firstScreenChanged) writeFileSync(firstScreenPath, themedFirstScreen);
  return gameChanged || firstScreenChanged;
};

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const buildDirectory = process.argv[2] ? resolve(process.argv[2]) : generatedBuild;
    const patched = patchWeChatBootstrap(buildDirectory);
    console.log(patched
      ? 'Applied Cat 2048 runtime bridge to the Cocos WeChat first screen.'
      : 'Cocos WeChat first-screen runtime bridge is already applied.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
