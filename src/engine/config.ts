// House rules (PRD section 4). The engine reads rules only from a RuleConfig (R-CFG-01).

export interface RuleConfig {
  entryRule: 'onStart' | 'needChammaOrAshta';
  noHitBehavior: 'circle' | 'block';
  triplePenalty: boolean;
  doubles: boolean;
  doubleCrossing: 'free' | 'blockOnce';
  bonusOnHome: boolean;
  playToEnd: boolean;
}

export const CLASSIC: Readonly<RuleConfig> = Object.freeze({
  entryRule: 'needChammaOrAshta',
  noHitBehavior: 'block',
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
  noHitBehavior: ['circle', 'block'],
  triplePenalty: [true, false],
  doubles: [true, false],
  doubleCrossing: ['free', 'blockOnce'],
  bonusOnHome: [true, false],
  playToEnd: [true, false],
};

export const RULE_KEYS = Object.keys(RULE_OPTIONS) as RuleKey[];

export function isValidConfig(config: RuleConfig): boolean {
  return RULE_KEYS.every((key) => (RULE_OPTIONS[key] as readonly unknown[]).includes(config[key]));
}
