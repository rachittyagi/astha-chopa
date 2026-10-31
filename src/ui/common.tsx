import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, MIN_TOUCH } from './theme';

export function Screen({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
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

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  fill: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  button: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accent },
  dim: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  primaryText: { color: colors.onAccent },
  secondaryText: { color: colors.accent },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segment: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.accent,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  segmentSelected: { backgroundColor: colors.accent },
  segmentText: { color: colors.accent, fontWeight: '600' },
  segmentTextSelected: { color: colors.onAccent },
});
