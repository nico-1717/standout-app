import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Card, Field } from '@/ui/kit';

import { validTime } from './plan';

/** Impostazioni › Promemoria: due interruttori e l'ora di quello delle abitudini. Restano su questo telefono. */
export function RemindersCard() {
  const th = useTheme();
  const { t } = useTranslation();
  const { reminders, updateReminders } = useApp();
  const [denied, setDenied] = useState(false);
  const [time, setTime] = useState(reminders.habitTime);
  const [timeError, setTimeError] = useState(false);

  async function toggle(key: 'pills' | 'habits', on: boolean) {
    const ok = await updateReminders({ [key]: on });
    setDenied(!ok);
  }

  function saveTime() {
    if (!validTime(time)) return setTimeError(true);
    setTimeError(false);
    void updateReminders({ habitTime: time });
  }

  const row = (testID: string, label: string, key: 'pills' | 'habits') => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: th.text, flex: 1 }}>{label}</Text>
      <Switch testID={testID} value={reminders[key]} onValueChange={(v) => void toggle(key, v)} />
    </View>
  );

  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <Text style={{ color: th.text, fontWeight: '700' }}>{t('app.promemoria_t')}</Text>
      <Text style={{ color: th.text2, lineHeight: 20 }}>{t('app.promemoria_p')}</Text>
      {row('rem-pills', t('app.promemoria_pastiglie'), 'pills')}
      {row('rem-habits', t('app.promemoria_abitudini'), 'habits')}
      {reminders.habits ? (
        <>
          <Text style={{ color: th.text2 }}>{t('app.promemoria_ora')}</Text>
          <Field
            testID="rem-time"
            value={time}
            onChangeText={setTime}
            onEndEditing={saveTime}
            onBlur={saveTime}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          {timeError ? (
            <Text testID="rem-time-error" style={{ color: th.red }}>
              {t('app.promemoria_ora_errore')}
            </Text>
          ) : null}
        </>
      ) : null}
      {denied ? (
        <Text testID="rem-denied" style={{ color: th.red, lineHeight: 20 }}>
          {t('app.promemoria_negato')}
        </Text>
      ) : null}
    </Card>
  );
}
