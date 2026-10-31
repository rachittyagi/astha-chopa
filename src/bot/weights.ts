// Medium heuristic weights (PRD section 5). Starting points; tune freely.
export const WEIGHTS = {
  /** Hits an opponent pawn: plus hitProgress × that pawn's path index. */
  hit: 100,
  hitProgress: 2,
  /** First hit of the game for this player (unlocks the inner ring). */
  firstHit: 60,
  home: 80,
  enter: 35,
  safe: 30,
  /** Leaves a square where an opponent could hit it. */
  escape: 40,
  /** Multiplied by the chance of being hit next turn. */
  danger: 50,
  outerDouble: 20,
  /** Per square advanced. */
  progress: 1,
} as const;

export type Weights = typeof WEIGHTS;

/** Easy takes an available hit this often (PRD section 5). */
export const EASY_HIT_RATE = 0.5;

/** Hard searches throw orders only for pools up to this size, keeping this many moves per step. */
export const HARD_MAX_POOL = 3;
export const HARD_BEAM = 3;

/** Pause before each bot action, in ms (R-BOT-02). */
export const BOT_DELAY_MIN_MS = 600;
export const BOT_DELAY_MAX_MS = 1000;

/** Hard: value of being able to hit next turn, multiplied by that chance. */
export const HARD_THREAT = 40;
