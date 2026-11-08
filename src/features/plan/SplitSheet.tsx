import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/features/habits/Sheet';
import { PrimaryButton, TextButton } from '@/ui/kit';
import { haptic } from '@/ui/motion';

import { hours, hoursField, parseHours } from './format';
import { evenSplit, rebalance, type SplitRow } from './split';
import { usePlanTheme } from './ui';

export interface SplitKid {
  uuid: string;
  name: string;
  color: string;
  minutes: number;
  locked: boolean;
  hasKids: boolean;
}

const toRows = (kids: SplitKid[]): SplitRow[] =>
  kids.map(({ uuid, minutes, locked }) => ({ uuid, minutes, locked }));

/**
 * «Dividi il tempo fra i sotto-progetti» (split_save del sito): ogni figlio ha il suo tempo; quando se ne cambia uno gli altri
 * danno o prendono tempo in proporzione (la stessa matematica del sito), il lucchetto tiene fermo un valore e il totale resta
 * quello del progetto. Al posto del cursore ci sono i tasti −/+ (15 minuti) e il valore si può anche scrivere.
 */
export function SplitSheet(p: {
  visible: boolean;
  name: string;
  total: number;
  kids: SplitKid[];
  onSave: (total: number, rows: SplitRow[]) => void;
  onOpenKid: (uuid: string) => void;
  onClose: () => void;
}) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const [rows, setRows] = useState<SplitRow[]>(() => toRows(p.kids));
  const [editing, setEditing] = useState<{ uuid: string; text: string } | null>(null);
  const [wasOpen, setWasOpen] = useState(p.visible);
  if (p.visible !== wasOpen) {
    setWasOpen(p.visible);
    if (p.visible) {
      setRows(toRows(p.kids));
      setEditing(null);
    }
  }

  const sum = rows.reduce((a, r) => a + r.minutes, 0);
  const byId = new Map(p.kids.map((k) => [k.uuid, k]));
  const nudge = (uuid: string, d: number) => {
    const me = rows.find((r) => r.uuid === uuid);
    if (!me) return;
    haptic.tap();
    setRows(rebalance(rows, uuid, me.minutes + d, p.total));
  };
  const lock = (uuid: string) =>
    setRows(rows.map((r) => (r.uuid === uuid ? { ...r, locked: !r.locked } : r)));
  const commitEdit = () => {
    if (!editing) return;
    const m = parseHours(editing.text);
    if (m !== null) setRows(rebalance(rows, editing.uuid, Math.round(m / 5) * 5, p.total));
    setEditing(null);
  };

  return (
    <Sheet
      visible={p.visible}
      title={t('piano.dividi_titolo')}
      th={ht}
      onClose={p.onClose}
      testID="split-sheet"
      footer={
        p.total > 0 ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TextButton
                testID="split-even"
                label={t('piano.dividi_pari')}
                onPress={() => setRows(evenSplit(rows, p.total))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                testID="split-save"
                label={t('piano.salva')}
                onPress={() => p.onSave(p.total, rows)}
              />
            </View>
          </View>
        ) : undefined
      }
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {p.total <= 0 ? (
          <Text testID="split-no-time" style={{ color: ht.text2, fontSize: 15 }}>
            {t('piano.dividi_senza_ore')}
          </Text>
        ) : (
          <>
            <Text style={{ color: ht.text2, fontSize: 13, lineHeight: 18 }}>
              {t('piano.dividi_aiuto', { t: hours(p.total) })}
            </Text>
            <Text
              testID="split-total"
              style={{ color: sum === p.total ? ht.text : ht.red, fontWeight: '800', fontSize: 18 }}
            >
              {hours(sum)} / {hours(p.total)}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                height: 10,
                borderRadius: 5,
                overflow: 'hidden',
                backgroundColor: ht.surface2,
              }}
            >
              {rows.map((r) => (
                <View
                  key={r.uuid}
                  style={{
                    flexGrow: Math.max(0.0001, r.minutes),
                    backgroundColor: byId.get(r.uuid)!.color,
                  }}
                />
              ))}
            </View>
            {rows.map((r) => {
              const k = byId.get(r.uuid)!;
              const pct = p.total ? Math.round((r.minutes / p.total) * 100) : 0;
              const diff = r.locked ? 0 : r.minutes - k.minutes;
              return (
                <View
                  key={r.uuid}
                  style={{
                    gap: 8,
                    backgroundColor: ht.surface,
                    borderRadius: 18,
                    padding: 14,
                    opacity: r.locked ? 0.8 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: k.color }}
                    />
                    <Text
                      style={{ color: ht.text, flex: 1, fontWeight: '700', fontSize: 15 }}
                      numberOfLines={1}
                    >
                      {k.name}
                    </Text>
                    {diff !== 0 ? (
                      <Text
                        testID={`split-delta-${r.uuid}`}
                        style={{
                          color: diff > 0 ? ht.green : ht.text2,
                          fontSize: 12,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {diff > 0 ? '+' : '−'}
                        {hours(Math.abs(diff))}
                      </Text>
                    ) : null}
                    {k.hasKids ? (
                      <Pressable
                        testID={`split-open-${r.uuid}`}
                        accessibilityRole="button"
                        accessibilityLabel={t('piano.apri', { n: k.name })}
                        onPress={() => p.onOpenKid(r.uuid)}
                        hitSlop={8}
                      >
                        <Text style={{ color: ht.accent, fontSize: 20 }}>›</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: ht.surface2,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        height: 8,
                        backgroundColor: k.color,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable
                      testID={`split-minus-${r.uuid}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('piano.meno')}
                      disabled={r.locked}
                      onPress={() => nudge(r.uuid, -15)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: ht.surface2,
                        opacity: r.locked ? 0.35 : 1,
                      }}
                    >
                      <Text style={{ color: ht.text, fontSize: 22 }}>−</Text>
                    </Pressable>
                    {editing?.uuid === r.uuid ? (
                      <TextInput
                        testID={`split-edit-${r.uuid}`}
                        accessibilityLabel={t('piano.ore')}
                        autoFocus
                        selectTextOnFocus
                        keyboardType="decimal-pad"
                        value={editing.text}
                        onChangeText={(text) => setEditing({ uuid: r.uuid, text })}
                        onBlur={commitEdit}
                        onSubmitEditing={commitEdit}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          color: ht.text,
                          fontWeight: '700',
                          fontSize: 16,
                          backgroundColor: ht.surface2,
                          borderRadius: 12,
                          paddingVertical: 10,
                        }}
                      />
                    ) : (
                      <Pressable
                        testID={`split-value-${r.uuid}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${k.name} ${hours(r.minutes)}`}
                        disabled={r.locked}
                        onPress={() => setEditing({ uuid: r.uuid, text: hoursField(r.minutes) })}
                        style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}
                      >
                        <Text
                          style={{
                            color: ht.text,
                            fontWeight: '700',
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {hours(r.minutes)} · {pct}%
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      testID={`split-plus-${r.uuid}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('piano.piu')}
                      disabled={r.locked}
                      onPress={() => nudge(r.uuid, 15)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: ht.surface2,
                        opacity: r.locked ? 0.35 : 1,
                      }}
                    >
                      <Text style={{ color: ht.text, fontSize: 22 }}>+</Text>
                    </Pressable>
                    <Pressable
                      testID={`split-lock-${r.uuid}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: r.locked }}
                      accessibilityLabel={
                        r.locked
                          ? t('piano.sblocca', { n: k.name })
                          : t('piano.blocca', { n: k.name })
                      }
                      onPress={() => lock(r.uuid)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: r.locked ? ht.accent : ht.surface2,
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>{r.locked ? '🔒' : '🔓'}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}
