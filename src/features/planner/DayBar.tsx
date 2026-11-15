import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/CappedText';

import { PrioritiesCard } from './DayExtras';
import { LineIcon } from './PlannerIcons';
import type { PlannerTheme } from './plannerTheme';
import type { Priority } from './repo';

const MAX_PRIORITIES = 6;

/** Le priorità in una riga sola (.pl-prio.pl-slim): la casellina si spunta, il testo apre l'elenco. */
export function PriorityStrip(p: {
  pt: PlannerTheme;
  items: Priority[];
  onToggle: (position: number, content: string, done: boolean) => void;
  onOpen: () => void;
  onLists: () => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  const [page, setPage] = useState(0);
  const slots: (Priority | null)[] = [...p.items];
  if (slots.length < MAX_PRIORITIES) slots.push(null); // la casella per scriverne una nuova
  const pages = Math.ceil(slots.length / 2);
  const at = Math.min(page, pages - 1);
  const cells = slots.slice(at * 2, at * 2 + 2);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <Pressable
        testID="planner-lists"
        accessibilityRole="button"
        accessibilityLabel={t('planner.liste_della_settimana')}
        onPress={p.onLists}
        style={({ pressed }) => ({
          width: 34,
          height: 34,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pt.accentWash,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <LineIcon name="lists" color={pt.accentInk} size={15} />
      </Pressable>
      <View
        testID="priorities"
        style={{
          flex: 1,
          height: 34,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 9,
          borderRadius: 14,
          backgroundColor: pt.field,
          borderWidth: 0.5,
          borderColor: pt.fieldRing,
        }}
      >
        <Pressable testID="priority-open" accessibilityRole="button" onPress={p.onOpen} hitSlop={6}>
          <Text
            style={{
              color: pt.ink2,
              fontSize: 8,
              letterSpacing: 0.64,
              fontWeight: '500',
              fontFamily: pt.sans,
            }}
          >
            {t('planner.priorita').toLocaleUpperCase()}
          </Text>
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {cells.map((c, i) =>
            c ? (
              <PriorityCell
                key={c.uuid}
                pt={pt}
                item={c}
                onToggle={() => p.onToggle(c.position, c.content, c.is_done !== 1)}
                onOpen={p.onOpen}
              />
            ) : (
              <Pressable
                key={`new-${at}-${i}`}
                testID="priority-add"
                accessibilityRole="button"
                onPress={p.onOpen}
                style={{
                  flex: 1,
                  height: 24,
                  justifyContent: 'center',
                  paddingHorizontal: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: pt.fieldRing,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ color: pt.ink3, fontSize: 12, fontStyle: 'italic', fontFamily: pt.sans }}
                >
                  ＋ {t('planner.priorita_n', { n: p.items.length + 1 })}
                </Text>
              </Pressable>
            ),
          )}
        </View>
        <View style={{ gap: 4 }}>
          {Array.from({ length: pages }, (_, i) => (
            <Pressable
              key={i}
              testID={`priority-page-${i}`}
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => setPage(i)}
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: i === at ? pt.accent : pt.ink3,
                opacity: i === at ? 1 : 0.5,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function PriorityCell(p: {
  pt: PlannerTheme;
  item: Priority;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { pt, item } = p;
  const done = item.is_done === 1;
  return (
    <View
      style={{
        flex: 1,
        height: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 6,
        borderRadius: 10,
        backgroundColor: pt.accentWash,
        borderWidth: 1.2,
        borderColor: pt.prioRing,
      }}
    >
      <Pressable
        testID={`priority-box-${item.position}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        hitSlop={6}
        onPress={p.onToggle}
        style={{
          width: 13,
          height: 13,
          borderRadius: 5,
          borderWidth: 1.2,
          borderColor: pt.prioRing,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: done ? pt.prioRing : 'transparent',
        }}
      >
        {done ? <LineIcon name="check" color="#FFFFFF" size={9} /> : null}
      </Pressable>
      <Pressable
        testID={`priority-${item.position}`}
        accessibilityRole="button"
        onPress={p.onOpen}
        style={{ flex: 1 }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: done ? pt.ink3 : pt.accentInk,
            fontSize: 12.5,
            fontFamily: pt.sans,
            textDecorationLine: done ? 'line-through' : 'none',
          }}
        >
          {item.content}
        </Text>
      </Pressable>
    </View>
  );
}

/** L'elenco completo delle priorità del giorno, in un foglio dal basso (si scrivono e si spuntano qui). */
export function PrioritySheet(p: {
  pt: PlannerTheme;
  date: string;
  items: Priority[];
  onSave: (position: number, text: string, done: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  return (
    <View
      testID="priority-sheet"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 60 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('comune.chiudi')}
        onPress={p.onClose}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,.35)',
        }}
      />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View
          style={{
            paddingBottom: 18,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: pt.page,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              paddingTop: 16,
            }}
          >
            <Text
              style={{
                color: pt.ink,
                fontSize: 20,
                fontWeight: pt.style === 'standard' ? '700' : '400',
                fontFamily: pt.serif,
              }}
            >
              {t('planner.priorita')}
            </Text>
            <Pressable
              testID="priority-close"
              accessibilityRole="button"
              onPress={p.onClose}
              hitSlop={8}
            >
              <Text style={{ color: pt.accentInk, fontSize: 16, fontFamily: pt.sans }}>
                {t('comune.chiudi')}
              </Text>
            </Pressable>
          </View>
          <PrioritiesCard pt={pt} date={p.date} items={p.items} onSave={p.onSave} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
