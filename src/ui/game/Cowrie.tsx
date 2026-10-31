// A cowrie shell (R-THROW-04): mouth up shows the toothed slit, mouth down the glossy, spotted back.
import Svg, { Defs, Ellipse, Line, LinearGradient, Path, RadialGradient, Stop, Circle } from 'react-native-svg';

const W = 40;
const H = 60;

/** Teeth along both lips of the slit, top to bottom. */
const TEETH = Array.from({ length: 10 }, (_, i) => 12 + i * 4);
/** Spots on the back, as [cx, cy, r]. */
const SPOTS: [number, number, number][] = [
  [14, 18, 2.2], [24, 14, 1.8], [28, 24, 2.4], [12, 30, 1.9], [21, 33, 2.6],
  [29, 38, 1.7], [15, 42, 2.2], [24, 47, 1.9], [19, 22, 1.4], [11, 37, 1.3],
];

export function Cowrie({ up, size = 36 }: { up: boolean; size?: number }) {
  const width = (size * W) / H;
  return (
    <Svg width={width} height={size} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="belly" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#e9dcc1" />
          <Stop offset="0.5" stopColor="#fbf6ea" />
          <Stop offset="1" stopColor="#e3d3b4" />
        </LinearGradient>
        <RadialGradient id="back" cx="0.4" cy="0.35" r="0.75">
          <Stop offset="0" stopColor="#f3e2bd" />
          <Stop offset="0.6" stopColor="#d9b67a" />
          <Stop offset="1" stopColor="#a87a3e" />
        </RadialGradient>
      </Defs>
      {up ? (
        <>
          <Ellipse cx={20} cy={30} rx={17} ry={27} fill="url(#belly)" stroke="#b39770" strokeWidth={1.5} />
          {TEETH.map((y) => (
            <Line key={`l${y}`} x1={14.5} y1={y} x2={18.5} y2={y + 0.6} stroke="#9c7b52" strokeWidth={1.4} strokeLinecap="round" />
          ))}
          {TEETH.map((y) => (
            <Line key={`r${y}`} x1={21.5} y1={y + 0.6} x2={25.5} y2={y} stroke="#9c7b52" strokeWidth={1.4} strokeLinecap="round" />
          ))}
          <Path d="M20 7 C 18.6 18, 21.4 40, 20 53" stroke="#4a2c14" strokeWidth={3} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <Ellipse cx={20} cy={30} rx={17} ry={27} fill="url(#back)" stroke="#8f6634" strokeWidth={1.5} />
          {SPOTS.map(([cx, cy, r]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#8a5a2b" opacity={0.45} />
          ))}
          <Ellipse cx={15} cy={20} rx={4} ry={9} fill="#ffffff" opacity={0.45} />
        </>
      )}
    </Svg>
  );
}
