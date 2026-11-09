import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';

import { CHECKPOINT_STEPS } from '../gameJuice';

/**
 * Le impostazioni della partita che stanno solo su questo telefono: ogni quante carte la pausa con i risultati
 * (0 = nessuna pausa) e i suoni.
 */
export function GameSettingsSheet({
  visible,
  vocab,
  onClose,
}: {
  visible: boolean;
  vocab: boolean;
  onClose: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const { localPrefs, updateLocalPrefs } = useApp();
  const ht = habitsTheme(th.scheme, th.brand, th.style);
  const every = localPrefs.fcCheckpoint;
  return (
    <Sheet
      visible={visible}
      th={ht}
      testID="fcg-settings"
      title={t('fcv.gs_titolo')}
      onClose={onClose}
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        <View style={{ gap: 10 }}>
          <Text style={{ color: ht.text, fontWeight: '700', fontSize: 16 }}>
            {t('fcv.gs_checkpoint')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CHECKPOINT_STEPS.map((n) => {
              const on = every === n;
              return (
                <Pressable
                  key={n}
                  testID={`fcg-ck-step-${n}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => updateLocalPrefs({ fcCheckpoint: n })}
                  style={{
                    minWidth: 52,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    alignItems: 'center',
                    borderRadius: 12,
                    backgroundColor: on ? th.brand : ht.surface2,
                  }}
                >
                  <Text style={{ color: on ? '#fff' : ht.text, fontWeight: '700' }}>
                    {n === 0 ? t('fcv.gs_ck_no') : n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text testID="fcg-ck-hint" style={{ color: ht.text2, fontSize: 13 }}>
            {every === 0
              ? t('fcv.gs_ck_spento')
              : t(vocab ? 'fcv.gs_ck_ogni' : 'fcv.gs_ck_ogni_carte', { n: every })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: ht.text, fontWeight: '700', fontSize: 16 }}>
              {t('fcv.gs_suoni')}
            </Text>
            <Text style={{ color: ht.text2, fontSize: 13 }}>{t('fcv.gs_suoni_sub')}</Text>
          </View>
          <Switch
            testID="fcg-sounds"
            value={localPrefs.fcSounds}
            onValueChange={(v) => updateLocalPrefs({ fcSounds: v })}
            accessibilityLabel={t('fcv.gs_suoni')}
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}
