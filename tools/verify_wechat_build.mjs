import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = join(root, 'game', 'build', 'wechatgame');
const gameJsonPath = join(buildRoot, 'game.json');
const firstScreenPath = join(buildRoot, 'first-screen.js');
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
if (!existsSync(firstScreenPath)) {
  fail('missing generated WeChat first-screen file');
}
if (!readFileSync(firstScreenPath, 'utf8').includes('CAT2048_CUSTOM_LOADING_SCREEN')) {
  fail('custom WeChat loading screen has not been applied');
}

const gameJson = JSON.parse(readFileSync(gameJsonPath, 'utf8'));
const subpackages = Array.isArray(gameJson.subpackages) ? gameJson.subpackages : [];
const resourcesPackage = subpackages.find((entry) => entry.name === 'resources');
if (!resourcesPackage?.root) {
  fail('game.json does not declare the resources subpackage');
}

const subpackageRoots = subpackages.map((entry) => resolve(buildRoot, entry.root));
const resourcesRoot = resolve(buildRoot, resourcesPackage.root);
if (!existsSync(resourcesRoot)) {
  fail(`missing resources subpackage directory ${relative(buildRoot, resourcesRoot)}`);
}

const allFiles = filesBelow(buildRoot);
const resourcesFiles = filesBelow(resourcesRoot);
const resourcesPng = resourcesFiles.filter((path) => extname(path).toLowerCase() === '.png');
const webp = allFiles.filter((path) => extname(path).toLowerCase() === '.webp');
const baseResourcesNative = join(buildRoot, 'assets', 'resources', 'native');
const baseRuntimeImages = existsSync(baseResourcesNative)
  ? filesBelow(baseResourcesNative).filter((path) => ['.png', '.webp'].includes(extname(path).toLowerCase()))
  : [];

if (resourcesPng.length !== 34) {
  fail(`expected 34 PNG files in resources subpackage, found ${resourcesPng.length}`);
}
if (webp.length > 0) {
  fail(`found ${webp.length} WebP files in the generated package`);
}
if (baseRuntimeImages.length > 0) {
  fail(`found ${baseRuntimeImages.length} runtime images in the main package resources bundle`);
}

const mainPackageFiles = allFiles.filter((path) => !subpackageRoots.some((directory) => isBelow(path, directory)));
const mainPackageBytes = mainPackageFiles.reduce((total, path) => total + statSync(path).size, 0);
if (mainPackageBytes > mainPackageLimit) {
  fail(`main package is ${mainPackageBytes} bytes, limit is ${mainPackageLimit}`);
}

const resourcesPackageBytes = resourcesFiles.reduce((total, path) => total + statSync(path).size, 0);
console.log(JSON.stringify({
  mainPackageBytes,
  resourcesPackageBytes,
  resourcesPngFiles: resourcesPng.length,
}, null, 2));
