import { AudioSource, Node } from 'cc';
import type { ArtRepository } from './ArtRepository';

export class AudioController {
  private readonly source: AudioSource;
  public enabled = true;

  public constructor(host: Node, private readonly art: ArtRepository) {
    this.source = host.getComponent(AudioSource) ?? host.addComponent(AudioSource);
  }

  public play(name: 'move' | 'merge' | 'game_over', volume = 1): void {
    if (!this.enabled) return;
    const clip = this.art.clip(name);
    if (clip) this.source.playOneShot(clip, volume);
  }
}
