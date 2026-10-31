import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { Button, Screen, Title } from '@/ui/common';
import { colors } from '@/ui/theme';

/** Placeholder for How to play and Settings until M4 (TASK-60, TASK-61). */
export function ComingSoonScreen({ section }: { section: 'howToPlay' | 'settings' }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <Title>{t(`${section}.title`)}</Title>
      <Text style={{ color: colors.muted, fontSize: 16 }}>{t(`${section}.comingSoon`)}</Text>
      <Button label={t('common.back')} onPress={() => router.back()} variant="secondary" />
    </Screen>
  );
}
