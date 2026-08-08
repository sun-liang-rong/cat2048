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

const catImagePaths = ['classic', 'sunny', 'aurora'].reduce<string[]>((paths, theme) => {
  const levels = 12;
  for (let index = 1; index <= levels; index += 1) {
    paths.push(`cats/${theme}/cat_${index < 10 ? '0' : ''}${index}.png`);
  }
  return paths;
}, []);

const buttonThemeImagePaths = ['berry', 'aurora'].reduce<string[]>((paths, theme) => {
  for (const state of ['primary', 'secondary', 'reward', 'cream']) {
    paths.push(`ui/button-themes/${theme}/${state}.png`);
  }
  return paths;
}, []);

const expectedImagePaths = [
  ...['bg_home.png', 'bg_page.png', 'share_score_bg.png'].map((name) => `backgrounds/common/${name}`),
  ...['wood', 'pink', 'star'].map((theme) => `backgrounds/board/${theme}/bg_board_${theme}.png`),
  ...catImagePaths,
  'ui/common/logo.png',
  'ui/common/tile_empty.png',
  'ui/common/tile_selected.png',
  ...[
    'back', 'check', 'classic_mode', 'close', 'coin', 'collection', 'daily', 'home', 'info',
    'level_complete', 'level_current', 'level_locked', 'locked', 'remove_lowest',
    'reward_video', 'settings', 'share', 'sound_off', 'sound_on', 'undo', 'weekly',
  ].map((name) => `ui/common/${name}.png`),
  ...buttonThemeImagePaths,
  ...['sparkle_small', 'merge_sparkle', 'merge_burst', 'max_halo']
    .map((name) => `effects/classic/${name}.png`),
  ...['aurora_sparkle', 'aurora_burst', 'aurora_paw_sparkle', 'aurora_paw_burst']
    .map((name) => `effects/aurora/${name}.png`),
  ...['stars_sparkle', 'stars_burst', 'stars_fish_sparkle', 'stars_confetti_burst']
    .map((name) => `effects/stars/${name}.png`),
  'fonts/score.png',
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
    const output = execFileSync('python3', ['../tools/fingerprint_runtime_assets.py'], {
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
