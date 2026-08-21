import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = join(root, 'packages', 'game', 'build', 'wechatgame');
const gameJsonPath = join(buildRoot, 'game.json');
const gameJsPath = join(buildRoot, 'game.js');
const firstScreenPath = join(buildRoot, 'first-screen.js');
const sourceResourcesRoot = join(root, 'packages', 'game', 'assets', 'resources');
const mainPackageLimit = 4 * 1024 * 1024;

const fail = (message) => {
  throw new Error(`Invalid WeChat build: ${message}`);
};

const filesBelow = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });

const isBelow = (path, directory) => path === directory || path.startsWith(`${directory}${sep}`);

if (!existsSync(gameJsonPath)) {
  fail(`missing ${relative(root, gameJsonPath)}`);
}
if (!existsSync(gameJsPath)) {
  fail(`missing ${relative(root, gameJsPath)}`);
}
if (!existsSync(firstScreenPath)) {
  fail(`missing ${relative(root, firstScreenPath)}`);
}
if (!readFileSync(gameJsPath, 'utf8').includes('CAT2048_COCOS_LOADING_BRIDGE')) {
  fail('Cocos first-screen runtime bridge has not been applied');
}
const firstScreenSource = readFileSync(firstScreenPath, 'utf8');
if (!firstScreenSource.includes('CAT2048_COCOS_LOADING_THEME')) {
  fail('Cat 2048 loading theme has not been applied to the Cocos first screen');
}
const requiredFirstScreenAssets = firstScreenSource.includes('useDefaultLogo = true')
  ? ['logo.png', 'slogan.png']
  : ['logo.png'];
for (const asset of requiredFirstScreenAssets) {
  if (!existsSync(join(buildRoot, asset))) {
    fail(`missing Cocos first-screen asset ${asset}`);
  }
}

const gameJson = JSON.parse(readFileSync(gameJsonPath, 'utf8'));
const subpackages = Array.isArray(gameJson.subpackages) ? gameJson.subpackages : [];
const resourcesPackage = subpackages.find((entry) => entry.name === 'resources');
const remoteRoot = join(buildRoot, 'remote');
const resourcesRoot = resourcesPackage?.root
  ? resolve(buildRoot, resourcesPackage.root)
  : join(remoteRoot, 'resources');
if (!existsSync(resourcesRoot)) {
  fail('missing resources output in either a subpackage or the remote bundle directory');
}

const excludedPackageRoots = subpackages.map((entry) => resolve(buildRoot, entry.root));
if (existsSync(remoteRoot)) excludedPackageRoots.push(remoteRoot);

const allFiles = filesBelow(buildRoot);
const resourcesFiles = filesBelow(resourcesRoot);
const resourcesPng = resourcesFiles.filter((path) => extname(path).toLowerCase() === '.png');
const webp = allFiles.filter((path) => extname(path).toLowerCase() === '.webp');
const baseResourcesNative = join(buildRoot, 'assets', 'resources', 'native');
const baseRuntimeImages = existsSync(baseResourcesNative)
  ? filesBelow(baseResourcesNative).filter((path) => ['.png', '.webp'].includes(extname(path).toLowerCase()))
  : [];

const sourcePngCount = filesBelow(sourceResourcesRoot)
  .filter((path) => extname(path).toLowerCase() === '.png').length;
if (resourcesPng.length !== sourcePngCount) {
  fail(`expected ${sourcePngCount} PNG files in resources output, found ${resourcesPng.length}`);
}
if (webp.length > 0) {
  fail(`found ${webp.length} WebP files in the generated package`);
}
if (baseRuntimeImages.length > 0) {
  fail(`found ${baseRuntimeImages.length} runtime images in the main package resources bundle`);
}

const mainPackageFiles = allFiles.filter((path) =>
  !excludedPackageRoots.some((directory) => isBelow(path, directory)));
const mainPackageBytes = mainPackageFiles.reduce((total, path) => total + statSync(path).size, 0);
if (mainPackageBytes > mainPackageLimit) {
  fail(`main package is ${mainPackageBytes} bytes, limit is ${mainPackageLimit}`);
}

const resourcesPackageBytes = resourcesFiles.reduce((total, path) => total + statSync(path).size, 0);
console.log(JSON.stringify({
  mainPackageBytes,
  resourcesPackageBytes,
  resourcesPngFiles: resourcesPng.length,
  resourcesMode: resourcesPackage?.root ? 'subpackage' : 'remote',
}, null, 2));
