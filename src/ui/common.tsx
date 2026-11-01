import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import { font, MIN_TOUCH, radius, space, useThemedStyles, type Theme } from './theme';

const makeStyles = (c: Theme) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: space.lg, gap: space.md },
  fill: { flex: 1 },
  title: { fontSize: font.title, fontWeight: '700' as const, color: c.text },
  body: { fontSize: font.body, color: c.text, lineHeight: 26 },
  muted: { fontSize: font.label, color: c.muted },
  button: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primary: { backgroundColor: c.accent },
  secondary: { backgroundColor: c.surface, borderWidth: 2, borderColor: c.accent },
  // Pressed and disabled look different: a press darkens and sinks a little, disabled fades.
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  buttonText: { fontSize: font.button, fontWeight: '600' as const, textAlign: 'center' as const },
  large: { minHeight: 72, borderRadius: radius.lg },
  largeText: { fontSize: 26, fontWeight: '800' as const },
  primaryText: { color: c.onAccent },
  secondaryText: { color: c.accent },
  segmented: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  segment: {
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: c.accent,
    justifyContent: 'center' as const,
    backgroundColor: c.surface,
  },
  segmentSelected: { backgroundColor: c.accent },
  segmentText: { color: c.accent, fontWeight: '600' as const, fontSize: 17 },
  segmentTextSelected: { color: c.onAccent },
  choiceRow: {
    minHeight: 56,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: c.surface,
  },
  choiceText: { flex: 1, gap: 2 },
  choiceLabel: { fontSize: 15, color: c.muted, fontWeight: '600' as const },
  choiceValue: { fontSize: 17, color: c.text, fontWeight: '600' as const },
  chevron: { fontSize: 26, color: c.accent },
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center' as const, padding: space.xl },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    maxWidth: 480,
    maxHeight: '100%' as const,
    // A ScrollView grows to fill by default; the sheet should hug its content.
    flexGrow: 0,
    width: '100%' as const,
    alignSelf: 'center' as const,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800' as const, color: c.text, marginBottom: 4 },
  option: {
    minHeight: 52,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: c.muted,
  },
  optionSelected: { borderColor: c.accent, borderWidth: 2.5 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: c.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: c.accent },
  optionText: { flex: 1, fontSize: 17, color: c.text },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, marginLeft: -space.sm },
  back: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: space.sm,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: radius.sm,
  },
  backText: { color: c.accent, fontSize: font.label, fontWeight: '700' as const },
  headerTitle: { flex: 1, fontSize: font.heading, fontWeight: '800' as const, color: c.text },
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
        // Taps on buttons work while the keyboard is up, and the keyboard never hides a field (iOS).
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          {children}
        </ScrollView>
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
  size = 'normal',
}: {
  label: string;
  onPress(): void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /** `large` is the one main action on a screen (Play, Throw). */
  size?: 'normal' | 'large';
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
        size === 'large' && styles.large,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[styles.buttonText, size === 'large' && styles.largeText, primary ? styles.primaryText : styles.secondaryText]}
      >
        {label}
      </Text>
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
            style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && styles.pressed]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{labelOf(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A setting shown as one row (its name and current value) that opens a list of choices.
 * Used where the options are sentences too long to sit side by side.
 */
export function ChoiceRow<T extends string | boolean>({
  label,
  options,
  value,
  labelOf,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  labelOf(option: T): string;
  onChange(option: T): void;
}) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${labelOf(value)}`}
        style={({ pressed }) => [styles.choiceRow, pressed && styles.pressed]}
      >
        <View style={styles.choiceText}>
          <Text style={styles.choiceLabel}>{label}</Text>
          <Text style={styles.choiceValue}>{labelOf(value)}</Text>
        </View>
        <Text style={styles.chevron} importantForAccessibility="no" accessibilityElementsHidden>
          ›
        </Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          {/* Tapping the dimmed backdrop closes, as in the game's sheets. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false} />
          <ScrollView style={styles.sheet} contentContainerStyle={{ gap: 8 }}>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {label}
            </Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 8 }}>
              {options.map((option) => {
                const selected = option === value;
                return (
                  <Pressable
                    key={String(option)}
                    onPress={() => {
                      onChange(option);
                      close();
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <View style={styles.radio}>{selected && <View style={styles.radioDot} />}</View>
                    <Text style={styles.optionText}>{labelOf(option)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button label={t('common.cancel')} variant="secondary" onPress={close} />
          </ScrollView>
        </View>
      </Modal>
    </>
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

/** True when the system asks for less motion (R-A11Y): decorative animation is then left out. */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => live && setReduce(on));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/**
 * The top bar of a secondary screen: Back where people look for it, and the screen's title.
 * `onBack` defaults to going back, or Home when there is nothing to go back to.
 */
export function Header({ title, onBack }: { title: string; onBack?(): void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.header}>
      <Pressable
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={styles.backText}>{`‹ ${t('common.back')}`}</Text>
      </Pressable>
      <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
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
