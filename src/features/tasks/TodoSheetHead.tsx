import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { QuickNoteCard } from '@/features/notes/QuickNoteCard';
import { Text } from '@/ui/CappedText';

import { sansOf } from './TodoParts';
import { TodoTabs, type TodoTab } from './TodoTabs';
import type { TodoTheme } from './todoTheme';

/**
 * Il capo del riquadro «Attività» del sito (todo.php): titolo, frase, nota veloce e le tre linguette. Sul sito
 * To do, To buy e Pastiglie sono la stessa pagina: qui le tre schermate cominciano tutte da questo pezzo.
 */
export function TodoSheetHead({ td, current }: { td: TodoTheme; current: TodoTab }) {
  const { t } = useTranslation();
  const paper = td.style === 'paper';
  return (
    <>
      <View style={styles.head}>
        <Text
          accessibilityRole="header"
          style={{
            color: td.ink,
            fontSize: 34,
            lineHeight: 34,
            letterSpacing: paper ? 0 : -0.68,
            fontWeight: paper ? '400' : '700',
            fontStyle: paper ? 'italic' : 'normal',
            fontFamily: paper ? td.serif : undefined,
          }}
        >
          {t('todo.titolo')}
        </Text>
        <Text
          style={[
            {
              color: td.ink3,
              fontSize: paper ? 9.5 : 11,
              letterSpacing: paper ? 1.9 : 0.11,
              textTransform: 'uppercase',
              flexShrink: 1,
              textAlign: 'right',
            },
            sansOf(td),
          ]}
        >
          {t('todo.sottotitolo')}
        </Text>
      </View>
      <Text
        style={{
          color: td.ink2,
          fontSize: 15,
          lineHeight: 22.5,
          fontStyle: paper ? 'italic' : 'normal',
          fontFamily: paper ? td.serif : undefined,
          marginTop: 2,
          marginBottom: 16,
        }}
      >
        {t('todo.nota')}
      </Text>
      <QuickNoteCard td={td} paper={paper} />
      <TodoTabs current={current} bt={td} />
    </>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
});
