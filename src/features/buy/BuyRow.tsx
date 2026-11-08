import { memo, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ImageField } from '../media/ImageField';
import type { Task } from '../tasks/repo';
import { alpha, mix, type BuyTheme } from './buyTheme';
import { priceInput, toCents, type BuyCategory } from './logic';

export interface RowActions {
  toggle: (t: Task) => void;
  rename: (t: Task, title: string) => void;
  setPrice: (t: Task, cents: number | null) => void;
  setPriority: (t: Task, p: number) => void;
  setCategory: (t: Task, uuid: string | null) => void;
  setUrl: (t: Task, url: string | null) => void;
  remove: (t: Task) => void;
  newCategory: () => void;
}

/** Una riga del to buy: casella, nome (si scrive lì), prezzo (si scrive lì), freccia che apre i dettagli. */
export const BuyRow = memo(function BuyRow({
  task,
  bt,
  tint,
  cats,
  actions,
  last,
}: {
  task: Task;
  bt: BuyTheme;
  /** il colore della categoria: tinge il bordo della casella in «Corsie» */
  tint: string;
  cats: BuyCategory[];
  actions: RowActions;
  last: boolean;
}) {
  const { t } = useTranslation();
  const paper = bt.style === 'paper';
  const done = !!task.is_done;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [price, setPrice] = useState(priceInput(task.buy_price_cents));
  const [url, setUrl] = useState(task.buy_url ?? '');
  // Se la riga cambia da fuori (sincronizzazione), le caselle seguono.
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setPrice(priceInput(task.buy_price_cents)), [task.buy_price_cents]);
  useEffect(() => setUrl(task.buy_url ?? ''), [task.buy_url]);

  const prio = task.buy_priority || 3;
  const font = bt.sans ? { fontFamily: bt.sans } : null;
  const border = paper
    ? {
        borderBottomWidth: 1,
        borderBottomColor: alpha(bt.ink, 0.22),
        borderStyle: 'dotted' as const,
      }
    : !last
      ? { borderBottomWidth: 1, borderBottomColor: alpha(tint, 0.2) }
      : null;

  function commitTitle() {
    const v = title.trim();
    if (v === '') actions.remove(task);
    else if (v !== task.title) actions.rename(task, v);
  }
  function commitPrice() {
    const c = toCents(price);
    setPrice(priceInput(c));
    if (c !== task.buy_price_cents) actions.setPrice(task, c);
  }

  return (
    <View style={border}>
      <View style={[styles.row, { minHeight: paper ? 46 : 50 }]}>
        <Pressable
          onPress={() => actions.toggle(task)}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={t(done ? 'todo.tb_togli_dal_carrello' : 'todo.tb_preso')}
          style={[
            styles.check,
            paper
              ? { width: 22, height: 22, borderRadius: 11, borderColor: alpha(bt.ink, 0.38) }
              : {
                  width: 26,
                  height: 26,
                  borderRadius: 9,
                  borderColor: mix(tint, bt.card, 0.55),
                  backgroundColor: bt.card,
                },
            done && { backgroundColor: bt.accent, borderColor: bt.accent },
          ]}
        >
          {done ? (
            <Text style={{ color: bt.onAccent, fontSize: 13, fontWeight: '800' }}>✓</Text>
          ) : null}
        </Pressable>
        <View style={{ flex: 1 }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={commitTitle}
            onSubmitEditing={commitTitle}
            maxLength={300}
            placeholder={t('todo.cosa_vuoi_comprare')}
            placeholderTextColor={bt.ink3}
            style={[
              styles.title,
              font,
              {
                color: done ? bt.ink3 : bt.ink,
                textDecorationLine: done ? 'line-through' : 'none',
              },
            ]}
          />
          {prio < 3 || task.buy_url ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {prio < 3 ? (
                <Text
                  style={{
                    color: prio === 1 ? bt.late : '#E08A00',
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  !{prio}
                </Text>
              ) : null}
              {task.buy_url ? (
                <Text style={{ color: bt.ink2, fontSize: 12 }} numberOfLines={1}>
                  {hostOf(task.buy_url)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <View
          style={[
            styles.price,
            !paper && {
              backgroundColor: alpha(bt.card, 0.72),
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
            },
          ]}
        >
          <TextInput
            value={price}
            onChangeText={setPrice}
            onBlur={commitPrice}
            onSubmitEditing={commitPrice}
            placeholder="€"
            placeholderTextColor={bt.ink3}
            inputMode="decimal"
            style={[
              font,
              { color: bt.ink2, fontSize: 14, minWidth: 48, textAlign: 'right', padding: 0 },
            ]}
          />
        </View>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('todo.tb_dettagli')}
          accessibilityState={{ expanded: open }}
        >
          <Text
            style={{
              color: paper ? alpha(bt.ink, 0.4) : bt.ink3,
              fontSize: 16,
              width: 22,
              textAlign: 'center',
            }}
          >
            {open ? '⌃' : '⌄'}
          </Text>
        </Pressable>
      </View>
      {open ? (
        <View style={[styles.details, { paddingLeft: paper ? 34 : 38 }]}>
          <View style={styles.detRow}>
            <Text style={[styles.detLabel, font, { color: bt.ink2 }]}>{t('todo.priorita')}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3].map((p) => (
                <Pressable
                  accessibilityRole="button"
                  key={p}
                  onPress={() => actions.setPriority(task, p)}
                  style={[
                    styles.seg,
                    { backgroundColor: prio === p ? bt.accent : paper ? bt.panel : bt.card },
                  ]}
                >
                  <Text style={{ color: prio === p ? bt.onAccent : bt.ink, fontWeight: '600' }}>
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.detRow}>
            <Text style={[styles.detLabel, font, { color: bt.ink2 }]}>{t('todo.categoria')}</Text>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                justifyContent: 'flex-end',
              }}
            >
              {[
                { uuid: null as string | null, name: t('todo.senza_categoria'), color: '' },
                ...cats,
              ].map((c) => {
                const on = (task.buy_category_uuid ?? null) === c.uuid;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={c.uuid ?? 'none'}
                    onPress={() => actions.setCategory(task, c.uuid)}
                    style={[
                      styles.catChip,
                      { backgroundColor: on ? bt.accent : paper ? bt.panel : bt.card },
                    ]}
                  >
                    {c.color ? <View style={[styles.dot, { backgroundColor: c.color }]} /> : null}
                    <Text style={{ color: on ? bt.onAccent : bt.ink, fontSize: 13 }}>{c.name}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                onPress={actions.newCategory}
                style={[styles.catChip, { backgroundColor: paper ? bt.panel : bt.card }]}
              >
                <Text style={{ color: bt.accent, fontSize: 13 }}>
                  {t('todo.nuova_categoria_puntini')}
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.detRow}>
            <Text style={[styles.detLabel, font, { color: bt.ink2 }]}>{t('todo.tb_link')}</Text>
            <TextInput
              value={url}
              onChangeText={setUrl}
              onBlur={() => {
                const v = url.trim() || null;
                if (v !== (task.buy_url ?? null)) actions.setUrl(task, v);
              }}
              placeholder={t('todo.link_articolo')}
              placeholderTextColor={bt.ink3}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[
                styles.urlIn,
                font,
                { color: bt.ink, backgroundColor: paper ? bt.panel : bt.card },
              ]}
            />
            {task.buy_url ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('comune.apri')}
                onPress={() =>
                  void Linking.openURL(
                    /^https?:/i.test(task.buy_url!) ? task.buy_url! : 'https://' + task.buy_url!,
                  )
                }
                hitSlop={8}
              >
                <Text style={{ color: bt.accent, fontSize: 18 }}>↗</Text>
              </Pressable>
            ) : null}
          </View>
          <ImageField
            testID={`buy-img-${task.uuid}`}
            table="todos"
            uuid={task.uuid}
            slot="buy_image"
            name={task.buy_image}
            folder="private"
            label={t('todo.tb_aggiungi_foto')}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => actions.remove(task)}
            style={{ alignSelf: 'flex-start', paddingVertical: 8 }}
          >
            <Text style={{ color: bt.late, fontSize: 14 }}>{t('comune.elimina')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

function hostOf(u: string): string {
  try {
    return new URL(/^https?:/i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, '');
  } catch {
    return 'link';
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  check: { borderWidth: 1.6, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, paddingVertical: 4 },
  price: { alignItems: 'flex-end' },
  details: { paddingRight: 4, paddingBottom: 10, gap: 8 },
  detRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detLabel: { width: 74, fontSize: 13 },
  seg: { width: 38, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  urlIn: { flex: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14 },
});
