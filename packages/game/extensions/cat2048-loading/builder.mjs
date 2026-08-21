import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { patchWeChatBootstrap } from '../../../../scripts/customize_wechat_loading.mjs';

const extensionDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(extensionDirectory, '..', '..');
const projectPath = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Cocos WeChat loading hook received an empty build path.');
  }
  return value.startsWith('project://')
    ? resolve(projectRoot, value.slice('project://'.length))
    : resolve(value);
};

export async function onAfterBuild(options, result) {
  if (options?.platform !== 'wechatgame') return;

  const buildDirectory = result?.dest
    ? resolve(result.dest)
    : projectPath(options?.buildPath);
  patchWeChatBootstrap(buildDirectory);
}
