// Sound effects and haptics (R-UX-03). Both can be switched off in Settings.
import type { GameEvent, ThrowValue } from '@/engine';

export type Sound = 'throw' | 'step' | 'hit' | 'clap' | 'win' | 'chamma' | 'ashta' | 'whistle';
export type Haptic = 'throw' | 'hit';

export interface Cues {
  sounds: Sound[];
  haptics: Haptic[];
}

/** What to play for a batch of engine events (Chamma and Ashta are played when the shells settle). */
export function cuesFor(events: GameEvent[]): Cues {
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
        sounds.push('whistle');
        break;
      case 'PlayerFinished':
        if (event.rank === 1) sounds.push('win');
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
  clap: require('../../assets/sounds/clap.wav'),
  win: require('../../assets/sounds/win.wav'),
  chamma: require('../../assets/sounds/chamma.wav'),
  ashta: require('../../assets/sounds/ashta.wav'),
  whistle: require('../../assets/sounds/whistle.wav'),
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

/** Chamma (4) and Ashta (8) are special throws and get their own sound. */
export function specialThrowSound(value: ThrowValue): Sound | null {
  return value === 4 ? 'chamma' : value === 8 ? 'ashta' : null;
}

export function playSound(sound: Sound, settings: { sound: boolean }): void {
  if (!settings.sound) return;
  const p = player(sound);
  if (p) {
    void p.seekTo(0);
    p.play();
  }
}

export function playCues(cues: Cues, settings: { sound: boolean; haptics: boolean }): void {
  for (const sound of cues.sounds) playSound(sound, settings);
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
/** Speak a short phrase with the device's own text-to-speech (offline, no network). */
export function speak(text: string, language: 'en' | 'hi'): void {
  try {
    const Speech = require('expo-speech') as typeof import('expo-speech');
    Speech.stop();
    // Full volume and a touch slower, so the number is loud and clear.
    Speech.speak(text, { language: language === 'hi' ? 'hi-IN' : 'en-IN', rate: 0.85, pitch: 1.05, volume: 1 });
  } catch {
    // No speech engine: stay quiet.
  }
}
/* eslint-enable @typescript-eslint/no-require-imports */
