import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { BuyCategory } from '@/features/buy/logic';
import { sansOf, TodoIcon, WhenField } from '@/features/tasks/TodoParts';
import type { TodoTheme } from '@/features/tasks/todoTheme';

import { itemError, toSave, type SortDest, type SortItem } from './sort';

/** La schermata di conferma dello smistamento: ogni voce si corregge o si toglie, e solo alla fine si salva. */
export function SortModal(p: {
  td: TodoTheme;
  paper: boolean;
  initial: SortItem[];
  cats: BuyCategory[];
  today: string;
  onCancel: () => void;
  onSave: (items: SortItem[]) => void;
}) {
  const { td } = p;
  const { t } = useTranslation();
  const [items, setItems] = useState<SortItem[]>(p.initial);
  const set = (i: number, patch: Partial<SortItem>) =>
    setItems((cur) => cur.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const kept = items.filter((i) => i.keep);
  const n = toSave(items).length;

  return (
    <Modal visible animationType="slide" onRequestClose={p.onCancel}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: td.page }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View testID="sort-modal" style={{ flex: 1, paddingTop: Platform.OS === 'ios' ? 54 : 30 }}>
          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
            <Text style={[{ color: td.ink, fontSize: 22, fontWeight: '700' }, sansOf(td)]}>
              {t('todo.nota_conferma_t')}
            </Text>
            <Text style={[{ color: td.ink2, fontSize: 13, marginTop: 4 }, sansOf(td)]}>
              {t('todo.nota_conferma_s', { n: kept.length })}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {kept.length === 0 ? (
              <Text
                testID="sort-empty"
                style={{ color: td.ink2, textAlign: 'center', padding: 24 }}
              >
                {t('todo.nota_tutto_tolto')}
              </Text>
            ) : null}
            {items.map((it, i) =>
              it.keep ? (
                <View
                  key={it.orig}
                  testID={`sort-item-${i}`}
                  style={{
                    backgroundColor: td.card,
                    borderRadius: 16,
                    padding: 12,
                    gap: 8,
                    borderWidth: 1,
                    borderColor: itemError(it) ? td.late : td.hair,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        flex: 1,
                        backgroundColor: td.panel,
                        borderRadius: 10,
                        padding: 3,
                      }}
                    >
                      {(['todo', 'buy'] as SortDest[]).map((d) => (
                        <Pressable
                          key={d}
                          testID={`sort-dest-${i}-${d}`}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: it.dest === d }}
                          onPress={() => set(i, { dest: d })}
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            paddingVertical: 7,
                            borderRadius: 8,
                            backgroundColor: it.dest === d ? td.accent : 'transparent',
                          }}
                        >
                          <Text
                            style={{
                              color: it.dest === d ? td.onAccent : td.ink2,
                              fontSize: 13,
                              fontWeight: '500',
                            }}
                          >
                            {d === 'todo' ? 'to do' : 'to buy'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      testID={`sort-remove-${i}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('todo.nota_togli')}
                      onPress={() => set(i, { keep: false })}
                      hitSlop={10}
                    >
                      <TodoIcon name="close" color={td.ink3} size={18} />
                    </Pressable>
                  </View>

                  <TextInput
                    testID={`sort-title-${i}`}
                    value={it.title}
                    onChangeText={(v) => set(i, { title: v })}
                    maxLength={300}
                    placeholder={t('todo.nota_titolo_ph')}
                    placeholderTextColor={td.ink3}
                    style={{
                      color: td.ink,
                      fontSize: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: td.hair,
                      paddingVertical: 6,
                    }}
                  />

                  {it.dest === 'todo' ? (
                    <>
                      <WhenField
                        td={td}
                        kind="date"
                        label={t('comune.data')}
                        value={it.date}
                        fallback={p.today}
                        testID={`sort-date-${i}`}
                        onChange={(v) => set(i, v ? { date: v } : { date: '', time: '' })}
                      />
                      {it.date ? (
                        <WhenField
                          td={td}
                          kind="time"
                          label={t('todo.nota_ora')}
                          value={it.time}
                          fallback="09:00"
                          testID={`sort-time-${i}`}
                          onChange={(v) => set(i, { time: v })}
                        />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {[{ uuid: null as string | null, name: t('todo.senza_categoria') }]
                            .concat(p.cats.map((c) => ({ uuid: c.uuid, name: c.name })))
                            .map((c) => {
                              const on = !it.newCategory && it.catUuid === c.uuid;
                              return (
                                <Pressable
                                  key={c.uuid ?? 'none'}
                                  testID={`sort-cat-${i}-${c.uuid ?? 'none'}`}
                                  accessibilityRole="radio"
                                  accessibilityState={{ selected: on }}
                                  onPress={() => set(i, { catUuid: c.uuid, newCategory: null })}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 14,
                                    backgroundColor: on ? td.accent : td.panel,
                                  }}
                                >
                                  <Text style={{ color: on ? td.onAccent : td.ink2, fontSize: 13 }}>
                                    {c.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          {it.newCategory ? (
                            <View
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 14,
                                backgroundColor: td.accent,
                              }}
                            >
                              <Text style={{ color: td.onAccent, fontSize: 13 }}>
                                {it.newCategory} · {t('todo.nota_nuova_cat')}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </ScrollView>
                      <TextInput
                        testID={`sort-price-${i}`}
                        value={it.price}
                        onChangeText={(v) => set(i, { price: v })}
                        keyboardType="decimal-pad"
                        placeholder="€ 0,00"
                        placeholderTextColor={td.ink3}
                        style={{
                          color: td.ink,
                          fontSize: 15,
                          borderBottomWidth: 1,
                          borderBottomColor: td.hair,
                          paddingVertical: 6,
                        }}
                      />
                    </>
                  )}

                  {it.from !== it.title ? (
                    <Text style={{ color: td.ink3, fontSize: 12 }}>
                      {t('todo.nota_da', { t: it.from })}
                    </Text>
                  ) : null}
                </View>
              ) : null,
            )}
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              padding: 16,
              paddingBottom: Platform.OS === 'ios' ? 30 : 16,
              backgroundColor: td.card,
            }}
          >
            <Pressable
              testID="sort-cancel"
              accessibilityRole="button"
              onPress={p.onCancel}
              style={{
                flex: 1,
                alignItems: 'center',
                padding: 14,
                borderRadius: 14,
                backgroundColor: td.panel,
              }}
            >
              <Text style={{ color: td.ink2, fontWeight: '500' }}>{t('comune.annulla')}</Text>
            </Pressable>
            <Pressable
              testID="sort-save"
              accessibilityRole="button"
              accessibilityState={{ disabled: n === 0 }}
              disabled={n === 0}
              onPress={() => p.onSave(items)}
              style={{
                flex: 2,
                alignItems: 'center',
                padding: 14,
                borderRadius: 14,
                backgroundColor: td.accent,
                opacity: n === 0 ? 0.45 : 1,
              }}
            >
              <Text style={{ color: td.onAccent, fontWeight: '600' }}>
                {t(n === 1 ? 'todo.nota_salva_1' : 'todo.nota_salva_n', { n })}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
