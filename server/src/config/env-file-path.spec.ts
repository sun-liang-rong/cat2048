import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveServerEnvFilePath } from './env-file-path';

describe('resolveServerEnvFilePath', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
      recursive: true,
      force: true,
    })));
  });

  it('finds server/.env when the compiled app is started outside the server directory', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cat2048-env-'));
    temporaryDirectories.push(projectRoot);
    const compiledModuleDirectory = join(projectRoot, 'server', 'dist', 'src');
    const envFilePath = join(projectRoot, 'server', '.env');
    await mkdir(compiledModuleDirectory, { recursive: true });
    await writeFile(envFilePath, 'WECHAT_APP_ID=wx0b643dbdc055d948\n');

    expect(resolveServerEnvFilePath(compiledModuleDirectory, projectRoot)).toBe(envFilePath);
  });
});
