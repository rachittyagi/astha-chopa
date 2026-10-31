import type { ReactNode } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MIN_TOUCH, useThemedStyles, type Theme } from './theme';

const makeStyles = (c: Theme) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  fill: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700' as const, color: c.text },
  body: { fontSize: 16, color: c.text, lineHeight: 22 },
  muted: { fontSize: 14, color: c.muted },
  button: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primary: { backgroundColor: c.accent },
  secondary: { backgroundColor: c.surface, borderWidth: 2, borderColor: c.accent },
  dim: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontWeight: '600' as const, textAlign: 'center' as const },
  primaryText: { color: c.onAccent },
  secondaryText: { color: c.accent },
  segmented: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  segment: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: c.accent,
    justifyContent: 'center' as const,
    backgroundColor: c.surface,
  },
  segmentSelected: { backgroundColor: c.accent },
  segmentText: { color: c.accent, fontWeight: '600' as const },
  segmentTextSelected: { color: c.onAccent },
  toggle: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
  },
});

export function Screen({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <SafeAreaView style={styles.screen}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  label: string;
  onPress(): void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Text style={[styles.buttonText, primary ? styles.primaryText : styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

/** A row of mutually exclusive options. */
export function Segmented<T extends string | boolean>({
  options,
  value,
  labelOf,
  onChange,
  accessibilityLabel,
}: {
  options: readonly T[];
  value: T;
  labelOf(option: T): string;
  onChange(option: T): void;
  accessibilityLabel?: string;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={String(option)}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{labelOf(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  const { theme, styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.toggle}>
      <Text style={styles.body}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: theme.accent, false: theme.muted }}
        thumbColor={theme.surface}
      />
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const { styles } = useThemedStyles(makeStyles);
  return <Text style={muted ? styles.muted : styles.body}>{children}</Text>;
}
