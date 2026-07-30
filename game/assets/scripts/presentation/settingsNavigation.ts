export type SettingsOrigin = 'home' | 'game';

export function settingsOrigin(hasActiveBoard: boolean): SettingsOrigin {
  return hasActiveBoard ? 'game' : 'home';
}
