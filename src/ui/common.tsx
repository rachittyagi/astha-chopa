import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import { Icon } from './icons';
import { font, fonts, MIN_TOUCH, radius, shadow, space, useThemedStyles, type Theme } from './theme';

const makeStyles = (c: Theme) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: space.lg, gap: space.md, width: '100%' as const, maxWidth: 640, alignSelf: 'center' as const },
  fill: { flex: 1 },
  title: { fontSize: font.title, fontFamily: fonts.display, color: c.accent, lineHeight: font.title * 1.15 },
  body: { fontSize: font.body, fontFamily: fonts.body, color: c.text, lineHeight: 24 },
  muted: { fontSize: font.label, fontFamily: fonts.body, color: c.muted, lineHeight: 21 },
  overline: { fontSize: font.overline, fontFamily: fonts.bold, letterSpacing: 1, color: '#6B4F38', marginTop: space.xs, textTransform: 'uppercase' as const },
  card: { backgroundColor: c.surface, borderRadius: 18, padding: space.md, gap: space.md, borderWidth: 1, borderColor: c.line },
  button: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: space.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primary: { backgroundColor: c.accent, boxShadow: `0 4px 0 ${c.accentEdge}`, marginBottom: 4 },
  secondary: { backgroundColor: c.surface, borderWidth: 2, borderColor: c.lineStrong },
  danger: { backgroundColor: c.dangerSurface, borderWidth: 2, borderColor: '#B3261E' },
  ghost: { backgroundColor: 'transparent', minHeight: 50 },
  // Pressed and disabled look different: a press sinks onto its edge, disabled fades.
  pressed: { opacity: 0.85, transform: [{ translateY: 2 }] },
  pressedPrimary: { boxShadow: `0 2px 0 ${c.accentEdge}` },
  disabled: { opacity: 0.4 },
  buttonText: { fontSize: font.button, fontFamily: fonts.semibold, textAlign: 'center' as const },
  large: { minHeight: 64, borderRadius: 20, marginBottom: 5, boxShadow: `0 5px 0 ${c.accentEdge}` },
  largeText: { fontSize: 24, fontFamily: fonts.heading },
  primaryText: { color: c.onAccent, fontFamily: fonts.bold },
  secondaryText: { color: c.ink },
  dangerText: { color: c.danger },
  ghostText: { color: c.accent },
  segmented: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: c.track,
  },
  segment: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 48,
    paddingHorizontal: space.sm,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  segmentSelected: { backgroundColor: c.accent },
  segmentText: { color: c.ink, fontFamily: fonts.semibold, fontSize: 15, textAlign: 'center' as const },
  segmentTextSelected: { color: c.onAccent, fontFamily: fonts.bold },
  choiceRow: {
    minHeight: 60,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  choiceText: { flex: 1, gap: 2 },
  choiceLabel: { fontSize: 13, color: c.muted, fontFamily: fonts.semibold },
  choiceValue: { fontSize: 16, color: c.text, fontFamily: fonts.semibold },
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center' as const, padding: space.xl },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: radius.sheet,
    padding: space.xl,
    gap: space.sm,
    maxWidth: 480,
    maxHeight: '100%' as const,
    // A ScrollView grows to fill by default; the sheet should hug its content.
    flexGrow: 0,
    width: '100%' as const,
    alignSelf: 'center' as const,
    ...shadow.overlay,
  },
  sheetTitle: { fontSize: 28, fontFamily: fonts.display, color: c.accent, marginBottom: 4, lineHeight: 32 },
  sheetBody: { fontSize: font.body, fontFamily: fonts.body, lineHeight: 24, color: c.muted, marginBottom: space.xs },
  option: {
    minHeight: 52,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.lineStrong,
  },
  optionSelected: { borderColor: c.accent, borderWidth: 2.5, backgroundColor: '#FFF8EC' },
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
  optionText: { flex: 1, fontSize: 16, fontFamily: fonts.body, color: c.text },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    minHeight: 64,
    marginHorizontal: -space.lg,
    marginTop: -space.lg,
    marginBottom: space.xs,
    paddingHorizontal: space.sm,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  back: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: radius.md,
  },
  headerTitle: { flex: 1, fontSize: font.heading, fontFamily: fonts.heading, color: c.text },
  toggle: {
    minHeight: 58,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
  },
  toggleText: { flex: 1, gap: 1 },
  toggleLabel: { fontSize: 15, fontFamily: fonts.semibold, color: c.text, lineHeight: 21 },
  toggleSub: { fontSize: 13, fontFamily: fonts.body, color: c.muted },
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

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  size = 'normal',
  dense = false,
}: {
  label: string;
  onPress(): void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Less side padding, for buttons sharing a row. */
  dense?: boolean;
  /** `large` is the one main action on a screen (Play, Continue). */
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
        styles[variant],
        primary && size === 'large' && styles.large,
        dense && { paddingHorizontal: space.md },
        pressed && styles.pressed,
        pressed && primary && styles.pressedPrimary,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, styles[`${variant}Text`], primary && size === 'large' && styles.largeText]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A row of mutually exclusive options on a recessed track. */
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
            style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && !selected && { opacity: 0.7 }]}
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
  const { theme, styles } = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${labelOf(value)}`}
        style={({ pressed }) => [styles.choiceRow, pressed && { opacity: 0.8 }]}
      >
        <View style={styles.choiceText}>
          <Text style={styles.choiceLabel}>{label}</Text>
          <Text style={styles.choiceValue}>{labelOf(value)}</Text>
        </View>
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <Icon name="back" size={20} color={theme.accent} strokeWidth={2.4} />
        </View>
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

/**
 * Asks before something that cannot be undone. Drawn by the app itself rather than the system
 * alert, so it looks the same and works everywhere (the system alert does nothing on web).
 */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessible={false} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.sheetBody}>{body}</Text>
          <Button label={confirmLabel} onPress={onConfirm} />
          <Button label={t('common.cancel')} variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

export function Toggle({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  /** A short line under the label saying what the setting does. */
  sub?: string;
  value: boolean;
  onChange(v: boolean): void;
}) {
  const { theme, styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sub && <Text style={styles.toggleSub}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: theme.accent, false: '#D8D2C8' }}
        thumbColor="#FFFFFF"
        // The web switch has its own prop for the thumb when on; native uses thumbColor for both.
        {...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : {})}
      />
    </View>
  );
}

/** A small capitalised label above a group of controls (QUICK CHOICE, SEATS, RULES). */
export function Overline({ children }: { children: ReactNode }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Text style={styles.overline} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** A cream card with a hairline edge, for grouped settings and rules. */
export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const { styles } = useThemedStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
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
  const { theme, styles } = useThemedStyles(makeStyles);
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.header}>
      <Pressable
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
      >
        <Icon name="back" color={theme.accent} strokeWidth={2.4} />
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
