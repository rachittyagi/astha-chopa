// Fails if any package that ships in the app could phone home (R-NET-01, R-LOCAL-02).
// Reads pnpm-lock.yaml and checks every non-dev package, including transitive ones.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

type DepMap = Record<string, string | { version: string }>;
type Snapshot = { dependencies?: DepMap; optionalDependencies?: DepMap };
type PackageInfo = {
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};
export type Lockfile = {
  importers: Record<string, { dependencies?: DepMap; optionalDependencies?: DepMap }>;
  packages?: Record<string, PackageInfo>;
  snapshots?: Record<string, Snapshot>;
};

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

// Snapshot key for a dependency entry. An aliased dependency stores "real-name@version" as its version.
function snapshotKey(name: string, version: string): string {
  return /^(@[^/]+\/)?[^@(]+@/.test(version) ? version : `${name}@${version}`;
}

function packageName(key: string): string {
  return key.slice(0, key.indexOf('@', 1));
}

// "name@1.0.0(peer@2.0.0)" -> "name@1.0.0", the key into lock.packages.
function baseKey(key: string): string {
  const paren = key.indexOf('(');
  return paren === -1 ? key : key.slice(0, paren);
}

// Every package reachable from the app's production dependencies, mapped to one path that pulls it in.
// Optional peers are skipped: pnpm fills them from anywhere in the tree, dev tools included, and
// any the app really ships are reached from the root. Required peers are followed, because pnpm
// installs them automatically when the app does not list them.
export function prodPackages(lock: Lockfile): Map<string, string> {
  const seen = new Map<string, string>();
  const queue: { key: string; via: string }[] = [];
  const add = (deps: DepMap | undefined, via: string, info?: PackageInfo) => {
    for (const [name, entry] of Object.entries(deps ?? {})) {
      if (info?.peerDependenciesMeta?.[name]?.optional) continue;
      const version = typeof entry === 'string' ? entry : entry.version;
      if (version.startsWith('link:') || version.startsWith('file:')) continue;
      queue.push({ key: snapshotKey(name, version), via: via ? `${via} > ${name}` : name });
    }
  };
  const root = lock.importers['.'];
  add(root?.dependencies, '');
  add(root?.optionalDependencies, '');
  while (queue.length > 0) {
    const { key, via } = queue.shift()!;
    if (seen.has(key)) continue;
    seen.set(key, via);
    const snap = lock.snapshots?.[key];
    const info = lock.packages?.[baseKey(key)];
    add(snap?.dependencies, via, info);
    add(snap?.optionalDependencies, via, info);
  }
  return seen;
}

export function findBanned(lock: Lockfile): string[] {
  const problems: string[] = [];
  for (const [key, via] of prodPackages(lock)) {
    const name = packageName(key);
    const hit = BANNED.find((b) => b.pattern.test(name));
    if (hit) problems.push(`${name} (${hit.reason}) via ${via}`);
  }
  return problems;
}

if (require.main === module) {
  const lock = parse(readFileSync(join(__dirname, '..', 'pnpm-lock.yaml'), 'utf8')) as Lockfile;
  const problems = findBanned(lock);
  if (problems.length > 0) {
    console.error('Banned packages in the app dependency tree:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`audit:deps OK — ${prodPackages(lock).size} packages checked, none banned.`);
}
