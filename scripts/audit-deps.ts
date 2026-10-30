// Fails if any package that ships in the app could phone home (R-NET-01, R-LOCAL-02).
// Reads package-lock.json and checks every non-dev package, including transitive ones.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type LockPackage = { dev?: boolean; devOptional?: boolean };
type Lockfile = { packages: Record<string, LockPackage> };

const BANNED: { pattern: RegExp; reason: string }[] = [
  { pattern: /^expo-updates$/, reason: 'checks for updates over the network on launch' },
  { pattern: /^expo-notifications$/, reason: 'push notifications need a network service' },
  { pattern: /^expo-insights$/, reason: 'analytics' },
  { pattern: /^(firebase|@firebase\/.*|@react-native-firebase\/.*)$/, reason: 'Firebase SDK' },
  { pattern: /^(@sentry\/.*|sentry-expo)$/, reason: 'crash reporter' },
  { pattern: /^(@bugsnag\/.*|@datadog\/.*|instabug-.*|@instabug\/.*)$/, reason: 'crash reporter' },
  { pattern: /^(@amplitude\/.*|@segment\/.*|mixpanel-.*|posthog-.*|@posthog\/.*)$/, reason: 'analytics' },
  { pattern: /^(react-native-google-mobile-ads|expo-ads-.*|react-native-fbads)$/, reason: 'ad SDK' },
  { pattern: /^(axios|got|node-fetch|superagent|ky)$/, reason: 'HTTP client' },
];

export function findBanned(lock: Lockfile): string[] {
  const problems: string[] = [];
  for (const [path, info] of Object.entries(lock.packages)) {
    if (path === '' || info.dev || info.devOptional) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const hit = BANNED.find((b) => b.pattern.test(name));
    if (hit) problems.push(`${name} (${hit.reason}) at ${path}`);
  }
  return problems;
}

if (require.main === module) {
  const lock = JSON.parse(readFileSync(join(__dirname, '..', 'package-lock.json'), 'utf8')) as Lockfile;
  const problems = findBanned(lock);
  if (problems.length > 0) {
    console.error('Banned packages in the app dependency tree:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`audit:deps OK — ${Object.keys(lock.packages).length - 1} packages checked, none banned.`);
}
