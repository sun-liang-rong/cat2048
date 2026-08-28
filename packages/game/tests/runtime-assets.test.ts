import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const gameRoot = fileURLToPath(new URL('..', import.meta.url));
const assetRoot = join(gameRoot, 'assets', 'resources', 'game');
const resourcesMetaPath = join(gameRoot, 'assets', 'resources.meta');
const wechatBuildConfigPath = join(gameRoot, 'build-wechatgame.json');

const filesBelow = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });

const catImagePaths = [
  'classic', 'sunny',
  'garden', 'fantasy', 'adventure',
  'costume', 'ocean', 'dream', 'jiguang',
].reduce<string[]>((paths, theme) => {
  const levels = 12;
  for (let index = 1; index <= levels; index += 1) {
    paths.push(`cats/${theme}/cat_${index < 10 ? '0' : ''}${index}.png`);
  }
  return paths;
}, []);

const collectionImagePaths = [
  'collection_back_paw.png',
  'collection_background.png',
  'collection_card_light.png',
  'collection_card_locked.png',
  'collection_lock.png',
  'collection_locked_cat.png',
].map((name) => `ui/collection/${name}`);

const gameplayImagePaths = [
  'stats_sprite_sheet.png',
].map((name) => `ui/gameplay/${name}`);

const taskIconImagePaths = [
  'task_play.png',
  'task_star.png',
  'task_bolt.png',
  'task_share.png',
  'task_check.png',
].map((name) => `ui/tasks/${name}`);

const settingsIconImagePaths = [
  'setting_sound.png',
  'setting_music.png',
  'setting_haptics.png',
].map((name) => `ui/settings/${name}`);

const homeImagePaths = [
  'home_background.png',
  'home_bottom_dock.png',
  'home_cat_room.png',
  'home_checkin_button.png',
  'home_coin.png',
  'home_collection.png',
  'home_leaderboard_button.png',
  'home_play_paw.png',
  'home_plus.png',
  'home_settings.png',
  'home_shop.png',
  'home_tasks.png',
].map((name) => `ui/home/${name}`);

const expectedImagePaths = [
  ...['bg_page.png', 'share_score_bg.png'].map((name) => `backgrounds/common/${name}`),
  ...['wood', 'pink', 'star'].map((theme) => `backgrounds/board/${theme}/bg_board_${theme}.png`),
  ...catImagePaths,
  'ui/common/logo.png',
  'ui/common/tile_empty.png',
  'ui/common/tile_selected.png',
  ...[
    'back', 'classic_mode', 'close', 'coin', 'collection', 'home', 'info',
    'locked', 'remove_lowest', 'restart', 'settings', 'share', 'sound_off', 'sound_on', 'undo',
  ].map((name) => `ui/common/${name}.png`),
  ...collectionImagePaths,
  ...gameplayImagePaths,
  ...taskIconImagePaths,
  ...settingsIconImagePaths,
  ...homeImagePaths,
  ...['sparkle_small', 'merge_sparkle', 'merge_burst', 'max_halo']
    .map((name) => `effects/classic/${name}.png`),
  ...['aurora_sparkle', 'aurora_burst']
    .map((name) => `effects/aurora/${name}.png`),
  ...['stars_sparkle', 'stars_burst']
    .map((name) => `effects/stars/${name}.png`),
].sort();

describe('runtime image assets', () => {
  it('keeps every runtime image in its type and theme directory', () => {
    const actual = filesBelow(assetRoot)
      .filter((path) => extname(path) === '.png')
      .map((path) => relative(assetRoot, path).split('\\').join('/'))
      .sort();

    expect(actual).toEqual(expectedImagePaths);
    expect(actual.some((path) => /^(branding|cosmetics|gameplay)\//.test(path))).toBe(false);
  });

  it('uses PNG files supported by the WeChat package filesystem', () => {
    const files = filesBelow(assetRoot);
    const images = files.filter((path) => ['.png', '.webp'].includes(extname(path)));

    expect(images).toHaveLength(expectedImagePaths.length);
    expect(images.every((path) => extname(path) === '.png')).toBe(true);
    expect(files.filter((path) => path.endsWith('.webp.meta'))).toEqual([]);

    for (const image of images) {
      const metaPath = `${image}.meta`;
      expect(existsSync(metaPath), `Missing metadata for ${relative(assetRoot, image)}`).toBe(true);
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { files?: string[] };
      expect(meta.files, `Invalid metadata for ${relative(assetRoot, image)}`).toContain('.png');
    }
  });

  it('includes PNG images in the semantic fingerprint', () => {
    const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    const output = execFileSync(pythonExecutable, ['../../scripts/fingerprint_runtime_assets.py'], {
      cwd: gameRoot,
      encoding: 'utf8',
    });
    const manifest = JSON.parse(output) as Record<string, { kind: string }>;
    const pngEntries = Object.values(manifest).filter((entry) => entry.kind === 'png');

    expect(pngEntries).toHaveLength(expectedImagePaths.length);
  });

  it('configures resources as a remote WeChat bundle', () => {
    const meta = JSON.parse(readFileSync(resourcesMetaPath, 'utf8')) as {
      userData?: {
        compressionType?: Record<string, string>;
        isRemoteBundle?: Record<string, boolean>;
      };
    };

    expect(meta.userData?.isRemoteBundle?.wechatgame).toBe(true);
  });

  it('pins the resources remote bundle in the reproducible WeChat build config', () => {
    expect(existsSync(wechatBuildConfigPath), 'Missing build-wechatgame.json').toBe(true);
    if (!existsSync(wechatBuildConfigPath)) return;

    const config = JSON.parse(readFileSync(wechatBuildConfigPath, 'utf8')) as {
      platform?: string;
      bundleConfigs?: Array<{
        name?: string;
        root?: string;
        compressionType?: string;
        isRemote?: boolean;
        output?: boolean;
      }>;
    };
    const resources = config.bundleConfigs?.find((bundle) => bundle.name === 'resources');

    expect(config.platform).toBe('wechatgame');
    expect(resources).toEqual(expect.objectContaining({
      root: 'db://assets/resources',
      isRemote: true,
      output: true,
    }));
  });
});
