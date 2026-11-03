import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PlannerTheme } from './plannerTheme';
import type { SmartParsed } from './smart';

/** La barra intelligente: si scrive «domani pranzo 15» e nasce l'evento. */
export function SmartBar(p: { pt: PlannerTheme; onSubmit: (text: string) => boolean }) {
  const { t } = useTranslation();
  const { pt } = p;
  const [text, setText] = useState('');
  const go = () => {
    if (!text.trim()) return;
    // se la frase non basta per un titolo, il testo resta lì per correggerlo
    if (p.onSubmit(text)) setText('');
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 12,
        marginBottom: 8,
        paddingLeft: 14,
        borderRadius: 999,
        backgroundColor: pt.card,
        borderWidth: 0.5,
        borderColor: pt.hair,
      }}
    >
      <TextInput
        testID="smart-input"
        value={text}
        onChangeText={setText}
        onSubmitEditing={go}
        returnKeyType="done"
        maxLength={200}
        placeholder={t('planner.domani_pranzo_15')}
        placeholderTextColor={pt.ink3}
        style={{ flex: 1, paddingVertical: 9, color: pt.ink, fontSize: 15, fontFamily: pt.sans }}
      />
      <Pressable
        testID="smart-go"
        accessibilityRole="button"
        accessibilityLabel={t('planner.crea')}
        onPress={go}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: pt.accentInk, fontSize: 20 }}>→</Text>
      </Pressable>
    </View>
  );
}

export interface SmartNote {
  key: number;
  parsed: SmartParsed;
  start: string;
  end: string;
  /** il giorno scritto in lettere («martedì 4 novembre») */
  when: string;
  onOpen: () => void;
}

/** Quello che la barra ha capito: si legge per qualche secondo, e toccandolo si apre l'evento. */
export function SmartReport(p: { pt: PlannerTheme; note: SmartNote | null; onHide: () => void }) {
  const { t } = useTranslation();
  const { pt, note } = p;
  const key = note?.key;
  const { onHide } = p;
  useEffect(() => {
    if (key === undefined) return;
    const id = setTimeout(onHide, 9000);
    return () => clearTimeout(id);
  }, [key, onHide]);
  if (!note) return null;
  const q = note.parsed;
  const hints: string[] = [];
  if (q.dateGuessed) hints.push(t('planner.giorno_non_indicato_ho_usato'));
  if (q.timeGuessed && q.allDay) hints.push(t('planner.ora_non_indicata_messo_su'));
  else if (q.timeGuessed) hints.push(t('planner.ora_dedotta'));
  hints.push(t('planner.tocca_sistemarlo'));
  return (
    <Pressable
      testID="smart-report"
      accessibilityRole="button"
      onPress={() => {
        p.onHide();
        note.onOpen();
      }}
      style={{
        position: 'absolute',
        left: 14,
        right: 84,
        bottom: 18,
        padding: 12,
        borderRadius: 16,
        backgroundColor: pt.card,
        borderWidth: 0.5,
        borderColor: pt.hair,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 5,
        gap: 2,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ color: pt.ink, fontSize: 15, fontFamily: pt.sans, fontWeight: '600' }}
      >
        “{q.title}”
      </Text>
      <Text style={{ color: pt.ink2, fontSize: 13, fontFamily: pt.sans }}>
        {note.when}
        {q.allDay
          ? t('planner.virgola_tutto_il_giorno')
          : t('planner.dalle_alle', { da: note.start, a: note.end })}
      </Text>
      <Text style={{ color: pt.ink3, fontSize: 11.5, fontFamily: pt.sans }}>
        {hints.join(' · ')}
      </Text>
    </Pressable>
  );
}
