const { dirname, resolve } = require('node:path');
const { patchWeChatBootstrap } = require('../../../../scripts/customize_wechat_loading.cjs');

const extensionDirectory = __dirname;
const projectRoot = resolve(extensionDirectory, '..', '..');
const projectPath = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Cocos WeChat loading hook received an empty build path.');
  }
  return value.startsWith('project://')
    ? resolve(projectRoot, value.slice('project://'.length))
    : resolve(value);
};

exports.onAfterBuild = async function onAfterBuild(options, result) {
  if (options?.platform !== 'wechatgame') return;

  const buildDirectory = result?.dest
    ? resolve(result.dest)
    : projectPath(options?.buildPath);
  patchWeChatBootstrap(buildDirectory);
};
