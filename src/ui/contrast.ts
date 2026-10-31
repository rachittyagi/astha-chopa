// WCAG 2.x contrast helpers (R-A11Y-04).

function channels(color: string): [number, number, number, number] {
  const rgba = color.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1]!.split(',').map((v) => v.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? [...hex].map((h) => h + h).join('') : hex.slice(0, 6);
  const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), alpha];
}

/** A colour with alpha, painted over an opaque background. */
function over(color: string, background: string): [number, number, number] {
  const [r, g, b, a] = channels(color);
  const [br, bg, bb] = channels(background);
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio of a foreground on a background (alpha composited over `base`, default white). */
export function contrast(foreground: string, background: string, base = '#ffffff'): number {
  const bg = over(background, base);
  const fg = over(foreground, `rgb(${bg.join(',')})`);
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on this colour. */
export function textOn(color: string): '#000000' | '#ffffff' {
  return contrast('#000000', color) >= contrast('#ffffff', color) ? '#000000' : '#ffffff';
}
