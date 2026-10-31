// Sound effects and haptics (R-UX-03). Both can be switched off in Settings.
import type { GameEvent, SeatId } from '@/engine';

export type Sound = 'throw' | 'step' | 'hit' | 'home' | 'win';
export type Haptic = 'throw' | 'hit';

export interface Cues {
  sounds: Sound[];
  haptics: Haptic[];
}

/** What to play for a batch of engine events; `humans` are the seats people play. */
export function cuesFor(events: GameEvent[], humans: SeatId[]): Cues {
  const sounds: Sound[] = [];
  const haptics: Haptic[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'ThrowResolved':
        sounds.push('throw');
        haptics.push('throw');
        break;
      case 'PawnMoved':
      case 'PawnEntered':
        sounds.push('step');
        break;
      case 'PawnHit':
        sounds.push('hit');
        haptics.push('hit');
        break;
      case 'PawnHome':
        sounds.push('home');
        break;
      case 'PlayerFinished':
        if (event.rank === 1 && humans.includes(event.seat)) sounds.push('win');
        break;
    }
  }
  return { sounds: [...new Set(sounds)], haptics: [...new Set(haptics)] };
}

/* eslint-disable @typescript-eslint/no-require-imports -- bundled assets and lazily loaded native modules */
const SOURCES: Record<Sound, number> = {
  throw: require('../../assets/sounds/throw.wav'),
  step: require('../../assets/sounds/step.wav'),
  hit: require('../../assets/sounds/hit.wav'),
  home: require('../../assets/sounds/home.wav'),
  win: require('../../assets/sounds/win.wav'),
};

type Player = { seekTo(seconds: number): unknown; play(): void };
const players = new Map<Sound, Player>();

function player(sound: Sound): Player | null {
  try {
    if (!players.has(sound)) {
      const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
      players.set(sound, createAudioPlayer(SOURCES[sound]));
    }
    return players.get(sound) ?? null;
  } catch {
    return null; // No audio on this device or in tests: stay silent.
  }
}

export function playCues(cues: Cues, settings: { sound: boolean; haptics: boolean }): void {
  if (settings.sound) {
    for (const sound of cues.sounds) {
      const p = player(sound);
      if (p) {
        void p.seekTo(0);
        p.play();
      }
    }
  }
  if (settings.haptics && cues.haptics.length > 0) {
    try {
      const Haptics = require('expo-haptics') as typeof import('expo-haptics');
      const style = cues.haptics.includes('hit') ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light;
      void Haptics.impactAsync(style).catch(() => undefined);
    } catch {
      // No haptics engine: nothing to do.
    }
  }
}
/* eslint-enable @typescript-eslint/no-require-imports */
