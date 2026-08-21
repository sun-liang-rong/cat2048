import { AudioSource, Node } from 'cc';
import type { ArtRepository } from '../utils/ArtRepository';

export class AudioController {
  private readonly source: AudioSource;
  private readonly musicSource: AudioSource;
  public enabled = true;
  public musicEnabled = true;

  public constructor(host: Node, private readonly art: ArtRepository) {
    this.source = host.getComponent(AudioSource) ?? host.addComponent(AudioSource);
    this.musicSource = host.addComponent(AudioSource);
    this.musicSource.loop = true;
    this.musicSource.volume = 0.35;
  }

  public play(name: 'move' | 'merge' | 'game_over', volume = 1): void {
    if (!this.enabled) return;
    const clip = this.art.clip(name);
    if (clip) this.source.playOneShot(clip, volume);
  }

  public playMusic(): void {
    if (!this.musicEnabled) return;
    const clip = this.art.clip('bgm');
    if (!clip) return;
    if (this.musicSource.clip !== clip || this.musicSource.playing === false) {
      this.musicSource.clip = clip;
      this.musicSource.play();
    }
  }

  public stopMusic(): void {
    this.musicSource.stop();
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (enabled) this.playMusic();
    else this.stopMusic();
  }
}
