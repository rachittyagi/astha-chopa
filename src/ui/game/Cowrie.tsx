// A cowrie shell seen from above (R-THROW-04): mouth up shows the dark toothed slit,
// mouth down the speckled back. `glow` marks the shells that counted once a throw settles.
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

const TEETH =
  'M15 19.8V21.2M20 19.1V21.2M25 18.6V21.2M30 18.4V21.2M35 18.6V21.2M40 19.1V21.2M45 19.8V21.2M15 22.8V24.2M20 22.8V24.9M25 22.8V25.4M30 22.8V25.6M35 22.8V25.4M40 22.8V24.9M45 22.8V24.2';
/** Speckles on the back, as [cx, cy, r]. */
const SPOTS: [number, number, number][] = [
  [18, 20, 1.6], [24, 25, 1.3], [33, 19, 1.5], [40, 26, 1.2], [44, 18, 1.4], [29, 30, 1.2],
];

/** `size` is the shell's width; it is a little under three quarters as tall. */
export function Cowrie({ up, size = 46, glow = false }: { up: boolean; size?: number; glow?: boolean }) {
  return (
    <Svg width={size} height={(size * 44) / 60} viewBox="0 0 60 44">
      {glow && <Ellipse cx={30} cy={22} rx={29.5} ry={21.5} fill="#FFE9A0" opacity={0.75} />}
      {up ? (
        <>
          <Ellipse cx={30} cy={23} rx={27} ry={19} fill="#C9AE86" />
          <Ellipse cx={30} cy={21.5} rx={27} ry={19} fill="#F3E7CF" />
          <Ellipse cx={25} cy={15} rx={15} ry={7} fill="#FFFBF2" opacity={0.8} />
          <Path d="M8 22C20 16 40 16 52 22C40 28 20 28 8 22Z" fill="#4A2A12" />
          <Path d={TEETH} stroke="#F3E7CF" strokeWidth={1.8} />
        </>
      ) : (
        <>
          <Ellipse cx={30} cy={23} rx={27} ry={19} fill="#A88458" />
          <Ellipse cx={30} cy={21.5} rx={27} ry={19} fill="#DCC296" />
          <Ellipse cx={25} cy={14} rx={16} ry={8} fill="#F2E4C6" opacity={0.85} />
          {SPOTS.map(([cx, cy, r]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#9A7448" />
          ))}
          <Path d="M9 26C22 31 40 31 51 24" stroke="#B69467" strokeWidth={1.6} fill="none" />
        </>
      )}
    </Svg>
  );
}
