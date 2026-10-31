// House rules (PRD section 4). The engine reads rules only from a RuleConfig (R-CFG-01).

export interface RuleConfig {
  entryRule: 'onStart' | 'needChammaOrAshta';
  /** Before a player's first hit: `free` = no restriction, `block` = stop at 15, `circle` = go round again. */
  noHitBehavior: 'free' | 'circle' | 'block';
  triplePenalty: boolean;
  doubles: boolean;
  doubleCrossing: 'free' | 'blockOnce';
  bonusOnHome: boolean;
  playToEnd: boolean;
}

export const CLASSIC: Readonly<RuleConfig> = Object.freeze({
  entryRule: 'needChammaOrAshta',
  noHitBehavior: 'free',
  triplePenalty: true,
  doubles: true,
  doubleCrossing: 'blockOnce',
  bonusOnHome: false,
  playToEnd: true,
});

export type RuleKey = keyof RuleConfig;

/** Allowed values per key, in display order; the setup screen builds its Custom toggles from this. */
export const RULE_OPTIONS: { readonly [K in RuleKey]: readonly RuleConfig[K][] } = {
  entryRule: ['onStart', 'needChammaOrAshta'],
  noHitBehavior: ['free', 'block', 'circle'],
  triplePenalty: [true, false],
  doubles: [true, false],
  doubleCrossing: ['free', 'blockOnce'],
  bonusOnHome: [true, false],
  playToEnd: [true, false],
};

export const RULE_KEYS = Object.keys(RULE_OPTIONS) as RuleKey[];

/** How many distinct house-rule combinations exist (every option of every key). */
export const RULE_COMBINATIONS = RULE_KEYS.reduce((n, key) => n * RULE_OPTIONS[key].length, 1);

/** Combination n (mod RULE_COMBINATIONS), counting through each key's options in turn. */
export function configNumber(n: number): RuleConfig {
  let rest = ((n % RULE_COMBINATIONS) + RULE_COMBINATIONS) % RULE_COMBINATIONS;
  const config = {} as Record<RuleKey, unknown>;
  for (const key of RULE_KEYS) {
    const options = RULE_OPTIONS[key];
    config[key] = options[rest % options.length];
    rest = Math.floor(rest / options.length);
  }
  return config as unknown as RuleConfig;
}

export function isValidConfig(config: RuleConfig): boolean {
  return RULE_KEYS.every((key) => (RULE_OPTIONS[key] as readonly unknown[]).includes(config[key]));
}
