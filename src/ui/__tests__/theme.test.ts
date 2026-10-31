import { contrast, textOn } from '@/ui/contrast';
import { PAWN_COLORS, THEMES, type ThemeName } from '@/ui/theme';

jest.mock('@/store/app', () => require('@/ui/testing/appStoreMock'));

const AA = 4.5;

describe('contrast helper', () => {
  it('matches known WCAG ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(textOn('#ffffff')).toBe('#000000');
    expect(textOn('#000000')).toBe('#ffffff');
  });
});

describe.each(Object.keys(THEMES) as ThemeName[])('theme %s meets WCAG AA (R-A11Y-04)', (name) => {
  const t = THEMES[name];
  it.each([
    ['text on background', t.text, t.background],
    ['text on surface', t.text, t.surface],
    ['muted on background', t.muted, t.background],
    ['muted on surface', t.muted, t.surface],
    ['button text on accent', t.onAccent, t.accent],
    ['accent text on surface', t.accent, t.surface],
    ['accent text on background', t.accent, t.background],
    ['warnings on background', t.danger, t.background],
    ['callout text on overlay', t.onOverlay, t.overlay],
  ])('%s', (_label, fg, bg) => {
    expect(contrast(fg, bg, t.background)).toBeGreaterThanOrEqual(AA);
  });

  it('safe-square marks and grid lines stand out from the board (3:1 for graphics)', () => {
    expect(contrast(t.safeMark, t.board)).toBeGreaterThanOrEqual(3);
  });
});

describe('pawn badges', () => {
  it.each(Object.entries(PAWN_COLORS))('count text on %s pawns is readable', (_name, color) => {
    expect(contrast(textOn(color), color)).toBeGreaterThanOrEqual(AA);
  });
});
