import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DateTimeField } from '@/ui/DateTimeField';
import { PrimaryButton, TextButton } from '@/ui/kit';
import { Sheet } from '@/features/habits/Sheet';

import { usePlanTheme } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');

/** L'ora a cui si propone di aver cominciato: adesso meno la durata; a cavallo della mezzanotte si resta nella giornata di oggi. */
export function proposedStart(now: Date, minutes: number): string {
  const d = new Date(now.getTime() - minutes * 60000);
  if (d.getDate() !== now.getDate()) return '00:00';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * «Ogni giorno»: avvia il timer da N minuti oppure «l'ho già fatto» (a che ora hai cominciato?). Come la finestrella di
 * progetti.php sul sito: la sessione che nasce vale come ogni altro pomodoro.
 */
export function DailySheet(p: {
  visible: boolean;
  name: string;
  minutes: number;
  now: Date;
  onStart: () => void;
  onLog: (start: string) => void;
  onClose: () => void;
}) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const [time, setTime] = useState('');
  const [wasOpen, setWasOpen] = useState(p.visible);
  if (p.visible !== wasOpen) {
    setWasOpen(p.visible);
    if (p.visible) {
      setAsking(false);
      setTime(proposedStart(p.now, p.minutes));
    }
  }
  return (
    <Sheet visible={p.visible} title={p.name} th={ht} onClose={p.onClose} testID="daily-sheet">
      <View style={{ padding: 20, gap: 14 }}>
        {asking ? (
          <>
            <Text style={{ color: ht.text, fontWeight: '700', fontSize: 17 }}>
              {t('progetti.daily_a_che_ora')}
            </Text>
            <View style={{ alignItems: 'center' }}>
              <DateTimeField
                kind="time"
                testID="daily-time"
                value={time}
                fallback={time || '12:00'}
                onChange={setTime}
              />
            </View>
            <PrimaryButton
              testID="daily-save"
              label={t('progetti.daily_salva', { m: p.minutes })}
              onPress={() => p.onLog(time)}
            />
            <TextButton
              testID="daily-back"
              label={t('comune.annulla')}
              onPress={() => setAsking(false)}
            />
          </>
        ) : (
          <>
            <Text style={{ color: ht.text, fontWeight: '700', fontSize: 17 }}>
              {t('progetti.daily_titolo', { m: p.minutes })}
            </Text>
            <Text style={{ color: ht.text2 }}>{t('progetti.daily_sub')}</Text>
            <PrimaryButton
              testID="daily-start"
              label={t('progetti.daily_avvia', { m: p.minutes })}
              onPress={p.onStart}
            />
            <PrimaryButton
              testID="daily-done"
              label={t('progetti.daily_gia_fatto')}
              onPress={() => setAsking(true)}
            />
            <TextButton testID="daily-cancel" label={t('comune.annulla')} onPress={p.onClose} />
          </>
        )}
      </View>
    </Sheet>
  );
}
