import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { BuyRow, type RowActions } from '@/features/buy/BuyRow';
import { alpha, buyTheme, mix, type BuyTheme } from '@/features/buy/buyTheme';
import {
  DEFAULT_CATEGORY_COLOR,
  formatEuro,
  groupBuy,
  norm,
  parseQuickAdd,
  sumCents,
  type BuyCategory,
} from '@/features/buy/logic';
import type { Task } from '@/features/tasks/repo';
import { cardShadow } from '@/ui/kit';
import { SyncBadge } from '@/ui/SyncBadge';

export default function BuyScreen() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { services, version, changed, uiStyle } = useApp();
  const bt = buyTheme(uiStyle, th);
  const paper = bt.style === 'paper';
  const [text, setText] = useState('');
  const [cartOpen, setCartOpen] = useState(false);

  const items = useMemo(
    () => (services ? services.tasks.list('buy') : []),
    // `version` cambia a ogni modifica (locale o dal server): è ciò che fa rileggere la lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );
  const cats = useMemo(
    () => (services ? services.categories.list() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, version],
  );
  const { groups, cart, open } = useMemo(() => groupBuy(items, cats), [items, cats]);
  const euro = (c: number) => formatEuro(c, i18n.language);
  const total = sumCents(open);

  function addLines(raw: string) {
    if (!services) return;
    // Più righe incollate = più articoli (come sul sito: si toglie l'elenco puntato davanti).
    const lines = raw
      .split(/\r?\n/)
      .map((s) => s.replace(/^[\s\-•*·\d.)]+(?=\D)/, '').trim())
      .filter(Boolean)
      .slice(0, 80);
    const known: BuyCategory[] = [...services.categories.list()];
    for (const line of lines) {
      const r = parseQuickAdd(line, known);
      if (!r.title) continue;
      let catUuid = r.catUuid;
      if (r.newCategory) {
        const existing = known.find((c) => norm(c.name) === norm(r.newCategory));
        catUuid = existing
          ? existing.uuid
          : services.categories.create(r.newCategory, DEFAULT_CATEGORY_COLOR);
        if (!existing) known.push(...services.categories.list().filter((c) => c.uuid === catUuid));
      }
      services.tasks.create(
        {
          title: r.title,
          ...(catUuid ? { buy_category_uuid: catUuid } : {}),
          ...(r.cents !== null ? { buy_price_cents: r.cents } : {}),
          ...(r.priority !== null ? { buy_priority: r.priority } : {}),
          ...(r.url ? { buy_url: r.url } : {}),
        },
        { listType: 'buy' },
      );
    }
    setText('');
    changed();
  }

  const actions: RowActions = {
    toggle: (task) => {
      services?.tasks.update(task.uuid, { is_done: !task.is_done });
      changed();
    },
    rename: (task, title) => {
      services?.tasks.update(task.uuid, { title });
      changed();
    },
    setPrice: (task, cents) => {
      services?.tasks.update(task.uuid, { buy_price_cents: cents });
      changed();
    },
    setPriority: (task, p) => {
      services?.tasks.update(task.uuid, { buy_priority: p });
      changed();
    },
    setCategory: (task, uuid) => {
      services?.tasks.update(task.uuid, { buy_category_uuid: uuid });
      changed();
    },
    setUrl: (task, url) => {
      services?.tasks.update(task.uuid, { buy_url: url });
      changed();
    },
    remove: (task) => {
      Alert.alert(t('todo.elimino_articolo'), task.title, [
        { text: t('comune.annulla'), style: 'cancel' },
        {
          text: t('comune.elimina'),
          style: 'destructive',
          onPress: () => {
            services?.tasks.remove(task.uuid);
            changed();
          },
        },
      ]);
    },
    newCategory: () => router.push('/categories'),
  };

  const font = bt.sans ? { fontFamily: bt.sans } : null;
  const colorOf = (c: BuyCategory | null) => c?.color || DEFAULT_CATEGORY_COLOR;
  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date());

  const renderRows = (list: Task[], tint: string) =>
    list.map((task, i) => (
      <BuyRow
        key={task.uuid}
        task={task}
        bt={bt}
        tint={tint}
        cats={cats}
        actions={actions}
        last={i === list.length - 1}
      />
    ));

  const cartBlock = cart.length ? (
    <View
      style={[
        { marginTop: 12 },
        paper
          ? null
          : {
              borderRadius: 24,
              backgroundColor: bt.panel === bt.page ? bt.card : bt.panel,
              paddingHorizontal: 14,
            },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => setCartOpen((o) => !o)}
        style={styles.cartHead}
      >
        <Text
          style={[
            font,
            { color: bt.ink2, fontSize: paper ? 13 : 15, fontWeight: paper ? '400' : '600' },
          ]}
        >
          🛒 {t('todo.tb_carrello')} · {cart.length}
          {sumCents(cart) ? ` · ${euro(sumCents(cart))}` : ''}
        </Text>
      </Pressable>
      {cartOpen ? (
        <View style={{ paddingBottom: 12 }}>
          {renderRows(cart, DEFAULT_CATEGORY_COLOR)}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              services?.tasks.removeMany(cart.map((c) => c.uuid));
              changed();
            }}
            style={[styles.clear, { backgroundColor: paper ? bt.panel : bt.card }]}
          >
            <Text style={[font, { color: bt.ink, fontWeight: '600' }]}>
              {t('todo.tb_svuota_carrello')}
            </Text>
          </Pressable>
          <Text style={[font, { color: bt.ink3, fontSize: 12, marginTop: 6 }]}>
            {t('todo.tb_carrello_nota')}
          </Text>
        </View>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: bt.page }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: paper ? bt.page : th.headerGlass,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: bt.hair,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={[
            font,
            {
              color: bt.ink,
              fontSize: paper ? 26 : 21,
              fontWeight: paper ? '400' : '800',
              letterSpacing: -0.42,
              fontFamily: paper ? bt.serif : undefined,
              fontStyle: paper ? 'italic' : 'normal',
            },
          ]}
        >
          {t('planner.to_buy')}
        </Text>
        <SyncBadge />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.addBar,
            paper
              ? { backgroundColor: bt.card, borderRadius: 14, ...cardShadow(false) }
              : { backgroundColor: bt.card, borderRadius: 20 },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => addLines(text)}
            returnKeyType="done"
            blurOnSubmit={false}
            multiline={false}
            placeholder={t('todo.tb_aggiungi_ph')}
            placeholderTextColor={bt.ink3}
            style={{
              flex: 1,
              color: bt.ink,
              fontSize: paper ? 22 : 16,
              fontFamily: paper ? bt.hand : undefined,
              paddingVertical: 8,
            }}
          />
          <Pressable
            onPress={() => addLines(text)}
            accessibilityRole="button"
            accessibilityLabel={t('comune.aggiungi')}
            style={[
              styles.addGo,
              { backgroundColor: paper ? bt.ink : bt.accent, borderRadius: paper ? 12 : 16 },
            ]}
          >
            <Text style={{ color: paper ? bt.card : '#fff', fontSize: 22, lineHeight: 24 }}>+</Text>
          </Pressable>
        </View>

        <View style={styles.sumRow}>
          <Text
            style={[
              font,
              { color: bt.ink2, fontSize: paper ? 12 : 15, letterSpacing: paper ? 1 : 0 },
            ]}
          >
            <Text style={{ color: bt.ink, fontWeight: paper ? '500' : '700' }}>{open.length}</Text>{' '}
            {t(open.length === 1 ? 'todo.tb_da_comprare_1' : 'todo.tb_da_comprare_n')}
            {paper && total ? (
              <Text style={{ color: bt.ink, fontWeight: '500' }}>{`  ·  ${euro(total)}`}</Text>
            ) : null}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/categories')}
            style={
              paper
                ? undefined
                : {
                    backgroundColor: bt.panel === bt.page ? bt.card : bt.panel,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                  }
            }
          >
            <Text style={[font, { color: bt.ink2, fontSize: 13 }]}>{t('todo.categorie')}</Text>
          </Pressable>
        </View>

        {!open.length && !cart.length ? (
          <View style={{ alignItems: 'center', marginTop: 40, gap: 6 }}>
            <Text style={[font, { color: bt.ink, fontWeight: '600' }]}>
              {t('todo.niente_da_comprare')}
            </Text>
            <Text style={[font, { color: bt.ink2, textAlign: 'center' }]}>
              {t('todo.tb_vuoto_aiuto')}
            </Text>
          </View>
        ) : null}

        {paper ? (
          <PaperSheet
            bt={bt}
            show={open.length + cart.length > 0}
            cap={`${t('todo.tb_lista')} · ${dateLabel}`}
          >
            {groups.map((g, gi) => (
              <View key={g.cat?.uuid ?? 'none'} style={{ marginTop: gi === 0 ? 0 : 18 }}>
                <View style={styles.paperHead}>
                  <Text style={{ fontFamily: bt.serif, fontSize: 21, color: bt.ink }}>
                    {g.cat ? g.cat.name : t('todo.senza_categoria')}
                  </Text>
                  <View style={[styles.lead, { borderColor: alpha('#4A443D', 0.28) }]} />
                  <Text style={[font, { color: bt.ink2, fontSize: 13 }]}>
                    {sumCents(g.items) ? euro(sumCents(g.items)) : ''}
                  </Text>
                </View>
                {renderRows(g.items, colorOf(g.cat))}
              </View>
            ))}
            {cartBlock}
          </PaperSheet>
        ) : (
          <>
            {groups.map((g) => {
              const c = colorOf(g.cat);
              const tint = mix(c, bt.card, 0.15);
              const nameColor = mix(c, bt.ink, 0.62);
              return (
                <View key={g.cat?.uuid ?? 'none'} style={[styles.lane, { backgroundColor: tint }]}>
                  <View style={styles.laneHead}>
                    <View style={[styles.dot, { backgroundColor: c }]} />
                    <Text style={{ color: nameColor, fontSize: 15, fontWeight: '600' }}>
                      {g.cat ? g.cat.name : t('todo.senza_categoria')}
                    </Text>
                    <Text style={{ color: mix(c, bt.ink2, 0.45), fontSize: 13, flex: 1 }}>
                      {g.items.length}
                    </Text>
                    <Text style={{ color: nameColor, fontSize: 13, fontWeight: '500' }}>
                      {sumCents(g.items) ? euro(sumCents(g.items)) : ''}
                    </Text>
                  </View>
                  {renderRows(g.items, c)}
                </View>
              );
            })}
            {cartBlock}
          </>
        )}
      </ScrollView>

      {!paper && (open.length > 0 || cart.length > 0) ? (
        <View style={[styles.foot, { backgroundColor: bt.footBg }]}>
          <View style={{ flex: 1 }}>
            {total ? (
              <Text style={{ color: bt.footFg, opacity: 0.72, fontSize: 12 }}>
                {t('todo.tb_da_spendere')}
              </Text>
            ) : null}
            <Text style={{ color: bt.footFg, fontSize: 22, fontWeight: '600' }}>
              {total
                ? euro(total)
                : `${open.length} ${t(open.length === 1 ? 'todo.tb_da_comprare_1' : 'todo.tb_da_comprare_n')}`}
            </Text>
          </View>
          {cart.length ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                Keyboard.dismiss();
                setCartOpen(true);
              }}
              style={[styles.footCart, { backgroundColor: alpha('#FFFFFF', 0.12) }]}
            >
              <Text style={{ color: bt.footFg, fontSize: 14, fontWeight: '500' }}>
                🛒 {t('todo.tb_pill_carrello')} {cart.length}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** La striscia di carta dello Scontrino, con il bordo inferiore a dentini. */
function PaperSheet({
  bt,
  show,
  cap,
  children,
}: {
  bt: BuyTheme;
  show: boolean;
  cap: string;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <View style={cardShadow(false)}>
      <View
        style={{
          backgroundColor: bt.card,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 24,
        }}
      >
        <Text
          style={{
            textAlign: 'center',
            fontSize: 10,
            letterSpacing: 3.2,
            color: bt.ink3,
            marginBottom: 12,
            fontFamily: bt.sans,
          }}
        >
          {cap.toUpperCase()}
        </Text>
        {children}
      </View>
      <View
        style={{ flexDirection: 'row', overflow: 'hidden', height: 8, backgroundColor: bt.card }}
      >
        {Array.from({ length: 40 }, (_, i) => (
          <View
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: bt.page,
              marginTop: 3,
              marginLeft: i === 0 ? 0 : 0,
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 4,
    gap: 8,
  },
  addGo: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
    marginHorizontal: 2,
  },
  lane: {
    borderRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
    marginTop: 12,
  },
  laneHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  paperHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingTop: 6,
    paddingBottom: 2,
  },
  lead: {
    flex: 1,
    minWidth: 12,
    height: 0,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    transform: [{ translateY: -4 }],
  },
  cartHead: { paddingVertical: 14 },
  clear: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  foot: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    borderRadius: 22,
    paddingVertical: 11,
    paddingLeft: 18,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  footCart: { minHeight: 44, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center' },
});
