import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const marker = 'CAT2048_CUSTOM_LOADING_SCREEN';
const generatedBuild = join(root, 'game', 'build', 'wechatgame');
const catSource = join(root, 'game', 'assets', 'resources', 'game', 'cats', 'cat_01.png');
const titleGenerator = join(root, 'tools', 'generate_wechat_loading_title.py');

const replacements = [
  ['let progressBarColor = [61 / 255, 197 / 255, 222 / 255, 1];', 'let progressBarColor = [0.92, 0.31, 0.23, 1];'],
  ['let progressBackground = [100 / 255, 111 / 255, 118 / 255, 1];', 'let progressBackground = [0.16, 0.13, 0.11, 1];'],
  ['let bgColor = [0.01568627450980392,0.03529411764705882,0.0392156862745098,0.00392156862745098];', 'let bgColor = [1, 0.94, 0.83, 1]; // CAT2048_CUSTOM_LOADING_SCREEN'],
];

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
  const result = spawnSync('python', [titleGenerator, temporaryOutput], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`Unable to generate loading title: ${result.stderr || result.stdout}`.trim());
  }
  renameSync(temporaryOutput, outputPath);
};

export const customizeWeChatLoadingScreen = (buildDirectory = generatedBuild) => {
  const firstScreenPath = join(buildDirectory, 'first-screen.js');
  const logoPath = join(buildDirectory, 'logo.png');
  const sloganPath = join(buildDirectory, 'slogan.png');

  for (const path of [firstScreenPath, catSource, titleGenerator]) {
    if (!existsSync(path)) throw new Error(`Required loading-screen file is missing: ${path}`);
  }

  runTitleGenerator(sloganPath);
  copyFileSync(catSource, logoPath);
  customizeFirstScreen(firstScreenPath);
};

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    customizeWeChatLoadingScreen();
    console.log('Applied Cat 2048 custom WeChat loading screen.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
