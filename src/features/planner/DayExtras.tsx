import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { EventView } from './events';
import { CheckBox } from './PlannerParts';
import type { PlannerTheme } from './plannerTheme';
import type { Priority, Routine } from './repo';

/** Le priorità del giorno: fino a sei righe, si scrivono e si spuntano qui. */
export function PrioritiesCard(p: {
  pt: PlannerTheme;
  date: string;
  items: Priority[];
  onSave: (position: number, text: string, done: boolean) => void;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  const [adding, setAdding] = useState(false);
  const free = [1, 2, 3, 4, 5, 6].find((n) => !p.items.some((i) => i.position === n));
  const empty = !p.items.length && !adding;
  return (
    <View
      testID="priorities"
      style={{
        marginHorizontal: 10,
        marginTop: 8,
        padding: 10,
        borderRadius: 16,
        backgroundColor: pt.card,
        borderWidth: 0.5,
        borderColor: pt.hair,
        gap: 4,
      }}
    >
      {empty ? (
        <Pressable
          testID="priority-empty"
          accessibilityRole="button"
          onPress={() => setAdding(true)}
        >
          <Text style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans }}>
            {t('planner.nessuna_priorita_tocca_per_aggiungerne')}
          </Text>
        </Pressable>
      ) : null}
      {p.items.map((i) => (
        <PriorityRow key={i.uuid} pt={pt} item={i} onSave={p.onSave} />
      ))}
      {adding && free ? (
        <NewPriority
          pt={pt}
          position={free}
          onDone={(text) => {
            setAdding(false);
            if (text.trim()) p.onSave(free, text, false);
          }}
        />
      ) : null}
      {!empty && !adding && free ? (
        <Pressable testID="priority-add" accessibilityRole="button" onPress={() => setAdding(true)}>
          <Text style={{ color: pt.accentInk, fontSize: 13, fontFamily: pt.sans }}>
            ＋ {t('planner.priorita_n', { n: free })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PriorityRow(p: {
  pt: PlannerTheme;
  item: Priority;
  onSave: (position: number, text: string, done: boolean) => void;
}) {
  const { pt, item } = p;
  const done = item.is_done === 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <CheckBox
        testID={`priority-box-${item.position}`}
        color={pt.accent}
        done={done}
        pt={pt}
        onPress={() => p.onSave(item.position, item.content, !done)}
      />
      <TextInput
        testID={`priority-${item.position}`}
        defaultValue={item.content}
        maxLength={200}
        onEndEditing={(e) => {
          const text = e.nativeEvent.text;
          if (text.trim() !== item.content) p.onSave(item.position, text, done);
        }}
        style={{
          flex: 1,
          paddingVertical: 6,
          color: done ? pt.ink2 : pt.ink,
          fontSize: 15,
          fontFamily: pt.sans,
          textDecorationLine: done ? 'line-through' : 'none',
        }}
      />
    </View>
  );
}

function NewPriority(p: { pt: PlannerTheme; position: number; onDone: (text: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  return (
    <TextInput
      testID="priority-new"
      autoFocus
      value={text}
      onChangeText={setText}
      maxLength={200}
      placeholder={t('planner.priorita_n', { n: p.position })}
      placeholderTextColor={p.pt.ink3}
      onSubmitEditing={() => p.onDone(text)}
      onEndEditing={() => p.onDone(text)}
      style={{ paddingVertical: 6, color: p.pt.ink, fontSize: 15, fontFamily: p.pt.sans }}
    />
  );
}

export interface RoutineBlock {
  group: string;
  name: string;
  start: string;
  end: string;
  count: number;
  collapsed: boolean;
}

/** I blocchi di routine di un giorno: dal «gruppo» di ogni pezzo. */
export function routineBlocks(events: EventView[], routines: Routine[]): RoutineBlock[] {
  const by = new Map<string, EventView[]>();
  for (const e of events) {
    if (e.routineGroup) by.set(e.routineGroup, [...(by.get(e.routineGroup) ?? []), e]);
  }
  return [...by.entries()]
    .map(([group, list]) => {
      const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
      const name =
        routines.find((r) => r.uuid === sorted[0]!.routineUuid)?.name ?? sorted[0]!.title;
      return {
        group,
        name,
        start: sorted[0]!.start,
        end: sorted[sorted.length - 1]!.end,
        count: sorted.length,
        collapsed: sorted.every((e) => e.routineCollapsed),
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Una routine chiusa è una riga sola; aperta, i suoi passaggi stanno nell'orario e questa riga la richiude. */
export function RoutineBar(p: {
  pt: PlannerTheme;
  block: RoutineBlock;
  onToggle: (b: RoutineBlock) => void;
  onDelete: (b: RoutineBlock) => void;
}) {
  const { t } = useTranslation();
  const { pt, block: b } = p;
  return (
    <View
      testID={`routine-${b.group}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: pt.accentSoft,
      }}
    >
      <Pressable
        testID={`routine-toggle-${b.group}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: !b.collapsed }}
        onPress={() => p.onToggle(b)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Text style={{ color: pt.accentInk, fontSize: 14 }}>{b.collapsed ? '▸' : '▾'}</Text>
        <Text style={{ width: 44, color: pt.ink2, fontSize: 11, fontFamily: pt.sans }}>
          {b.start}
        </Text>
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: pt.ink, fontSize: 14, fontFamily: pt.sans }}
        >
          {b.name}
        </Text>
        <Text style={{ color: pt.ink3, fontSize: 11 }}>
          {t('planner.n_passaggi', { n: b.count })}
        </Text>
      </Pressable>
      <Pressable
        testID={`routine-del-${b.group}`}
        accessibilityRole="button"
        accessibilityLabel={t('planner.elimina_tutta_la_routine')}
        onPress={() => p.onDelete(b)}
      >
        <Text style={{ color: '#B4645F', fontSize: 16 }}>✕</Text>
      </Pressable>
    </View>
  );
}
