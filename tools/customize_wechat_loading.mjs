import {
  copyFileSync,
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const marker = 'CAT2048_CUSTOM_LOADING_SCREEN';
const generatedBuild = join(root, 'game', 'build', 'wechatgame');
const logoSource = join(root, 'game', 'assets', 'resources', 'game', 'ui', 'common', 'logo.png');
const titleGenerator = join(root, 'tools', 'generate_wechat_loading_title.py');

const replacements = [
  ['let progressBarColor = [61 / 255, 197 / 255, 222 / 255, 1];', 'let progressBarColor = [0.92, 0.31, 0.23, 1];'],
  ['let progressBackground = [100 / 255, 111 / 255, 118 / 255, 1];', 'let progressBackground = [0.16, 0.13, 0.11, 1];'],
  ['let bgColor = [0.01568627450980392,0.03529411764705882,0.0392156862745098,0.00392156862745098];', 'let bgColor = [1, 0.94, 0.83, 1]; // CAT2048_CUSTOM_LOADING_SCREEN'],
];

export const filesHaveSameBytes = (left, right) => readFileSync(left).equals(readFileSync(right));

export const customizeFirstScreen = (firstScreenPath) => {
  const source = readFileSync(firstScreenPath, 'utf8');
  if (source.includes(marker)) return;

  const output = replacements.reduce((result, [expected, replacement]) => {
    if (!result.includes(expected)) {
      throw new Error(`Unsupported Cocos first-screen template: missing ${expected}`);
    }
    return result.replace(expected, replacement);
  }, source);

  writeFileSync(firstScreenPath, output);
};

const runTitleGenerator = (outputPath) => {
  const temporaryOutput = `${outputPath}.tmp`;
  const failures = [];

  for (const executable of ['python3', 'python']) {
    const result = spawnSync(executable, [titleGenerator, temporaryOutput], {
      cwd: root,
      encoding: 'utf8',
    });
    if (!result.error && result.status === 0) {
      renameSync(temporaryOutput, outputPath);
      return;
    }
    failures.push(result.error?.message || result.stderr || result.stdout || `${executable} exited ${result.status}`);
  }

  throw new Error(`Unable to generate loading title: ${failures.join(' | ') || 'Python 3 with Pillow is required'}`.trim());
};

export const customizeWeChatLoadingScreen = (buildDirectory = generatedBuild) => {
  const firstScreenPath = join(buildDirectory, 'first-screen.js');
  const logoPath = join(buildDirectory, 'logo.png');
  const sloganPath = join(buildDirectory, 'slogan.png');

  if (!existsSync(firstScreenPath)) {
    if (existsSync(join(buildDirectory, 'game.js'))) return false;
    throw new Error(`Required loading-screen file is missing: ${firstScreenPath}`);
  }

  for (const path of [firstScreenPath, logoSource, titleGenerator]) {
    if (!existsSync(path)) throw new Error(`Required loading-screen file is missing: ${path}`);
  }

  runTitleGenerator(sloganPath);
  copyFileSync(logoSource, logoPath);
  customizeFirstScreen(firstScreenPath);
  return true;
};

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const buildDirectory = process.argv[2] ? resolve(process.argv[2]) : generatedBuild;
    const customized = customizeWeChatLoadingScreen(buildDirectory);
    console.log(customized
      ? 'Applied Cat 2048 custom WeChat loading screen.'
      : 'Cocos first screen is disabled; no loading-screen customization is needed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
