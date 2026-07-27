import { sys } from 'cc';
import type { RandomSource } from '../core/types';
import { LocalGameStorage } from './storage';

export class RuntimeRandomSource implements RandomSource {
  public next(): number { return Math.random(); }
}

export const runtimeStorage = new LocalGameStorage(sys.localStorage);
