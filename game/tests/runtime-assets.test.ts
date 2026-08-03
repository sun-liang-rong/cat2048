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

describe('runtime image assets', () => {
  it('uses PNG files supported by the WeChat package filesystem', () => {
    const files = filesBelow(assetRoot);
    const images = files.filter((path) => ['.png', '.webp'].includes(extname(path)));

    expect(images).toHaveLength(81);
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
    const output = execFileSync('python', ['../tools/fingerprint_runtime_assets.py'], {
      cwd: gameRoot,
      encoding: 'utf8',
    });
    const manifest = JSON.parse(output) as Record<string, { kind: string }>;
    const pngEntries = Object.values(manifest).filter((entry) => entry.kind === 'png');

    expect(pngEntries).toHaveLength(81);
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
