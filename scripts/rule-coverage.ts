// Checks that every rule id in PRD sections 3–4, and every house-rule option value,
// is named in at least one engine test title (R-TEST-01).
//
//   npm run rules:coverage
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RULE_KEYS, RULE_OPTIONS } from '../src/engine';

const range = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);

/** PRD sections 3 and 4. R-CFG-03 is the setup screen, tested with the app in M3. */
export const RULE_IDS = [
  ...range('R-BOARD', 3),
  ...range('R-PATH', 4),
  ...range('R-THROW', 6),
  ...range('R-TURN', 6),
  ...range('R-MOVE', 5),
  ...range('R-HIT', 4),
  ...range('R-DBL', 5),
  ...range('R-WIN', 3),
  'R-CFG-01',
  'R-CFG-02',
  'R-CFG-04',
];

/** Ranges written in titles, like "R-HIT-01..04", count for every id inside them. */
export function idsNamed(text: string): Set<string> {
  const found = new Set<string>();
  for (const m of text.matchAll(/(R-[A-Z]+)-(\d{2})(?:\.\.(\d{2}))?/g)) {
    const [, prefix, from, to] = m;
    for (let n = Number(from); n <= Number(to ?? from); n++) found.add(`${prefix}-${String(n).padStart(2, '0')}`);
  }
  return found;
}

function testSources(): string {
  const dir = join(__dirname, '..', 'src', 'engine', '__tests__');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
}

function main(): void {
  const source = testSources();
  const named = idsNamed(source);
  const missingIds = RULE_IDS.filter((id) => !named.has(id));

  // An option value counts as tested when a test sets it, or (for defaults) the test names it.
  const missingOptions = RULE_KEYS.flatMap((key) =>
    RULE_OPTIONS[key]
      .filter((value) => !new RegExp(`${key}[^\\n]{0,40}\\b${String(value)}\\b|\\b${String(value)}\\b[^\\n]{0,40}${key}`).test(source))
      .map((value) => `${key}=${String(value)}`),
  );

  console.log(`Rule ids covered: ${RULE_IDS.length - missingIds.length}/${RULE_IDS.length}`);
  if (missingIds.length) console.log(`  missing: ${missingIds.join(', ')}`);
  const optionCount = RULE_KEYS.reduce((n, k) => n + RULE_OPTIONS[k].length, 0);
  console.log(`Config option values covered: ${optionCount - missingOptions.length}/${optionCount}`);
  if (missingOptions.length) console.log(`  missing: ${missingOptions.join(', ')}`);
  if (missingIds.length || missingOptions.length) process.exit(1);
}

if (require.main === module) main();
