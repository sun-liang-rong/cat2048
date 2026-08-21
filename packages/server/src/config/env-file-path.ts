import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function resolveServerEnvFilePath(
  moduleDirectory: string,
  currentWorkingDirectory: string,
): string | undefined {
  const candidates = [
    resolve(moduleDirectory, '../.env'),
    resolve(moduleDirectory, '../../.env'),
    resolve(currentWorkingDirectory, 'server/.env'),
    resolve(currentWorkingDirectory, 'packages/server/.env'),
    resolve(currentWorkingDirectory, '.env'),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}
