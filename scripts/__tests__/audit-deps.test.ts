import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { findBanned, prodPackages, type Lockfile } from '../audit-deps';

// A tiny pnpm v9 lockfile: the app depends on "ui", which has an optional peer "web" and a
// required peer "fonts"; "web" comes in only through a dev dependency.
function lockfile(extra: { rootDeps?: Record<string, string>; fontsDeps?: Record<string, string> } = {}): Lockfile {
  return {
    importers: { '.': { dependencies: { ui: '1.0.0(fonts@1.0.0)(web@1.0.0)', ...extra.rootDeps } } },
    packages: {
      'ui@1.0.0': { peerDependencies: { fonts: '*', web: '*' }, peerDependenciesMeta: { web: { optional: true } } },
      'fonts@1.0.0': {},
      'web@1.0.0': {},
    },
    snapshots: {
      'ui@1.0.0(fonts@1.0.0)(web@1.0.0)': { dependencies: { fonts: '1.0.0', web: '1.0.0', lib: '2.0.0' } },
      'fonts@1.0.0': { dependencies: { ...extra.fontsDeps } },
      'web@1.0.0': { dependencies: { 'node-fetch': '2.7.0' } },
      'lib@2.0.0': {},
      'node-fetch@2.7.0': {},
      'axios@1.0.0': {},
      'real-fetch@3.0.0': {},
    },
  };
}

describe('audit:deps (R-NET-01)', () => {
  it('follows transitive dependencies and required peers', () => {
    expect([...prodPackages(lockfile()).keys()].sort()).toEqual([
      'fonts@1.0.0',
      'lib@2.0.0',
      'ui@1.0.0(fonts@1.0.0)(web@1.0.0)',
    ]);
  });

  it('skips an optional peer that only a dev dependency supplies', () => {
    expect(findBanned(lockfile())).toEqual([]);
  });

  it('flags a banned package behind an optional peer the app ships itself', () => {
    expect(findBanned(lockfile({ rootDeps: { web: '1.0.0' } }))).toEqual([
      'node-fetch (HTTP client) via web > node-fetch',
    ]);
  });

  it('flags a banned package behind a required peer pnpm installs automatically', () => {
    expect(findBanned(lockfile({ fontsDeps: { axios: '1.0.0' } }))).toEqual([
      'axios (HTTP client) via ui > fonts > axios',
    ]);
  });

  it('checks the real package behind an alias', () => {
    expect(findBanned(lockfile({ rootDeps: { fetcher: 'node-fetch@2.7.0' } }))).toEqual([
      'node-fetch (HTTP client) via fetcher',
    ]);
  });

  it('on the real lockfile, includes required peers and leaves out the web-only react-native-web', () => {
    const lock = parse(readFileSync(join(__dirname, '..', '..', 'pnpm-lock.yaml'), 'utf8')) as Lockfile;
    const names = new Set([...prodPackages(lock).keys()].map((key) => key.slice(0, key.indexOf('@', 1))));
    expect(names.has('expo-font')).toBe(true);
    expect(names.has('react-native-web')).toBe(false);
    expect(findBanned(lock)).toEqual([]);
  });
});
