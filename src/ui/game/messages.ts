// Turns engine events into on-screen callouts and screen-reader announcements (R-UI-06, R-A11Y-02).
import type { TFunction } from 'i18next';

import type { GameEvent, GameState, ThrowValue } from '@/engine';

export interface EventMessage {
  /** Shown as a callout on the game screen. */
  callout?: string;
  /** Read out by the screen reader. */
  announce?: string;
}

/** What the voice says after a throw: "It's 3", "Chamma!" or "Ashta!". */
export function throwPhrase(value: ThrowValue, t: TFunction): string {
  if (value === 4) return t('game.speech.chamma');
  if (value === 8) return t('game.speech.ashta');
  return t('game.speech.value', { value });
}

export function messageFor(event: GameEvent, state: GameState, t: TFunction): EventMessage {
  const name = (id: string) => state.seats.find((s) => s.id === id)?.name ?? id;
  switch (event.type) {
    case 'ThrowResolved': {
      const announce = t('game.a11y.thrown', { name: name(event.seat), value: event.throw.value });
      if (event.throw.value === 4) return { callout: t('game.event.chamma'), announce };
      if (event.throw.value === 8) return { callout: t('game.event.ashta'), announce };
      return { announce };
    }
    case 'PawnHit':
      return { callout: t('game.event.hit'), announce: t('game.event.hit') };
    case 'InnerRingUnlocked':
      return { callout: t('game.event.innerRing'), announce: t('game.event.innerRing') };
    case 'PoolDiscarded':
      return { callout: t('game.event.noLegalMove'), announce: t('game.event.noLegalMove') };
    case 'TurnForfeited':
      return { callout: t('game.event.forfeited'), announce: t('game.event.forfeited') };
    case 'PawnHome':
      return { callout: t('game.event.home') };
    case 'PlayerFinished': {
      // First place gets the full-screen celebration instead.
      if (event.rank === 1) return {};
      const text = t('game.event.finished', { name: name(event.seat), rank: event.rank });
      return { callout: text, announce: text };
    }
    case 'StalemateBroken':
      return { callout: t('game.event.stalemate'), announce: t('game.event.stalemate') };
    case 'TurnPassed':
      return { announce: t('game.a11y.turn', { name: name(event.to) }) };
    default:
      return {};
  }
}
