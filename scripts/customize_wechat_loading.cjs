const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
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
            // 失败也要结束原生首屏，让应用自己的 LoadingView 显示重试按钮；
            // 否则 runtimeReady 会永久 pending，用户无法恢复。
            if (ready) return;
            ready = true;
            resolve();
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

const patchWeChatBootstrap = (buildDirectory = generatedBuild) => {
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

module.exports = { patchWeChatBootstrap };

const isCli = process.argv[1] && resolve(process.argv[1]) === __filename;
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
