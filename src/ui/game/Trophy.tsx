// A drawn trophy, the same on every platform (the emoji differs from phone to phone).
import Svg, { Path, Rect } from 'react-native-svg';

export function Trophy({ size = 72, color = '#e0a106', base = '#8a5a12' }: { size?: number; color?: string; base?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M12 10h8v6c0 6-4 10-8 10S4 22 4 16v-6h8zm0 4H8v2c0 3 2 6 4 6z" fill={color} />
      <Path d="M52 10h-8v6c0 6 4 10 8 10s8-4 8-10v-6h-8zm0 4h4v2c0 3-2 6-4 6z" fill={color} />
      <Path d="M16 6h32v14c0 10-7 18-16 18S16 30 16 20z" fill={color} />
      <Path d="M22 10h4v10c0 4 2 8 4 10-5-1-8-6-8-10z" fill="#ffffff" opacity={0.35} />
      <Rect x={28} y={38} width={8} height={10} fill={color} />
      <Rect x={18} y={48} width={28} height={10} rx={2} fill={base} />
    </Svg>
  );
}
