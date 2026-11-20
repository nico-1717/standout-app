import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/CappedText';

import type { PlannerTheme } from './plannerTheme';
import type { SmartAsk, SmartChoice } from './smartAsk';

/**
 * La domanda veloce della barra intelligente: «19 doccia» — il 19 è un giorno o un'ora? Due tasti grandi (con la
 * risposta già scritta per intero) e, più piccoli, «nessuna delle due» e «più tardi». Fuori dal riquadro = più tardi:
 * la frase resta in coda e la domanda torna alla prossima apertura.
 */
export function SmartAskSheet(p: {
  pt: PlannerTheme;
  phrase: string;
  ask: SmartAsk;
  /** le due risposte, già scritte («Data: martedì 19 novembre, tutto il giorno») */
  labels: { date: string; time: string };
  onChoose: (c: SmartChoice) => void;
  onLater: () => void;
}) {
  const { t } = useTranslation();
  const { pt, ask } = p;
  const big = (c: 'date' | 'time') => (
    <Pressable
      key={c}
      testID={`smart-ask-${c}`}
      accessibilityRole="button"
      onPress={() => p.onChoose(c)}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: pt.accentSoft,
        borderWidth: 0.5,
        borderColor: pt.accent,
      }}
    >
      <Text style={{ color: pt.accentInk, fontSize: 15, fontWeight: '600', fontFamily: pt.sans }}>
        {p.labels[c]}
      </Text>
    </Pressable>
  );
  return (
    <Modal transparent animationType="fade" onRequestClose={p.onLater}>
      <Pressable
        testID="smart-ask-backdrop"
        onPress={p.onLater}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            gap: 10,
            padding: 16,
            borderRadius: 18,
            backgroundColor: pt.card,
            borderWidth: 0.5,
            borderColor: pt.hair,
          }}
        >
          <Text
            testID="smart-ask-title"
            style={{ color: pt.ink, fontSize: 16, fontWeight: '700', fontFamily: pt.sans }}
          >
            {t('planner.smart_chiedi_t', { n: ask.n })}
          </Text>
          <Text numberOfLines={2} style={{ color: pt.ink2, fontSize: 13, fontFamily: pt.sans }}>
            “{p.phrase}”
          </Text>
          {ask.options.map(big)}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 }}>
            <Pressable
              testID="smart-ask-text"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => p.onChoose('text')}
            >
              <Text style={{ color: pt.ink2, fontSize: 13, fontFamily: pt.sans }}>
                {t('planner.smart_come_testo')}
              </Text>
            </Pressable>
            <Pressable
              testID="smart-ask-later"
              accessibilityRole="button"
              hitSlop={8}
              onPress={p.onLater}
            >
              <Text style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans }}>
                {t('planner.smart_piu_tardi')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
