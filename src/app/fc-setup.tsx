import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { DeckIcon } from '@/features/flashcards/DeckIcon';
import type { Direction, GameOrder, GameStatus } from '@/features/flashcards/game';
import { kitForCourse } from '@/features/flashcards/gameKit';
import { LEVEL_CHOICES, LEVEL_COLORS, type Level } from '@/features/flashcards/levels';
import { deckBranch, deckIcon, flattenDecks, type Deck } from '@/features/flashcards/logic';
import { Card, Header, SectionLabel } from '@/ui/kit';

/** Un interruttore a tre o due scelte (come i «segmented» del sito). */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  testID,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  testID: string;
}) {
  const th = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', backgroundColor: th.surface2, borderRadius: 10, padding: 3 }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testID}-${o.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: on ? th.surface : 'transparent',
            }}
          >
            <Text style={{ color: on ? th.text : th.text2, fontWeight: on ? '700' : '500' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Nuova partita di studio (fc_game_setup.php): ordine, stato delle carte, livelli, più categorie insieme (nell'ordine in cui
 * le tocchi) e l'elenco dei mazzi con quante carte ci sono. Si gioca una categoria con tutto quello che c'è sotto.
 * Parametro `preselect`: un mazzo da scegliere in partenza (dal tasto Gioca del mazzo).
 */
export default function GameSetupScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version } = useApp();
  const params = useLocalSearchParams<{ preselect?: string; course?: string }>();
  const kit = useMemo(
    () => (services ? kitForCourse(services, params.course) : null),
    [services, params.course],
  );
  const [direction, setDirection] = useState<Direction>('w2t');

  const [order, setOrder] = useState<GameOrder>('in_order');
  const [status, setStatus] = useState<GameStatus>('0');
  const [levels, setLevels] = useState<Level[]>([]);
  const [onlyHard, setOnlyHard] = useState(false);
  const [multi, setMulti] = useState(!!params.preselect);
  const [picked, setPicked] = useState<string[]>(() =>
    params.preselect && kit ? deckBranch(kit.decks(), params.preselect) : [],
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [empty, setEmpty] = useState(false);

  const data = useMemo(() => {
    void version;
    if (!kit) return null;
    return {
      decks: kit.decks(),
      counts: kit.games.deckCounts(status),
    };
  }, [kit, version, status]);
  if (!services || !kit || !data) return null;
  const { decks, counts } = data;

  const rows = [
    ...flattenDecks(decks, 'active', collapsed),
    ...flattenDecks(decks, 'archived', collapsed),
  ];
  const byId = new Map(decks.map((d) => [d.uuid, d]));
  /** le carte di un mazzo e di tutto quello che ha sotto */
  const branchCount = (id: string): number =>
    deckBranch(decks, id).reduce((n, x) => n + (counts.byDeck.get(x) ?? 0), 0);

  const play = (ids: string[]) => {
    const r = kit.games.start({
      decks: ids,
      direction: kit.vocab ? direction : undefined,
      status,
      order,
      levels: levels.length ? levels : undefined,
      onlyHard: onlyHard || undefined,
    });
    if (r.kind === 'empty') {
      setEmpty(true);
      return;
    }
    router.replace({ pathname: '/fc-game', params: { game: r.game, position: '1' } });
  };

  const togglePick = (id: string) => {
    // una categoria sceglie anche tutto quello che ha sotto, nell'ordine dell'albero
    const branch = deckBranch(decks, id);
    const has = branch.every((b) => picked.includes(b));
    setPicked(
      has
        ? picked.filter((p) => !branch.includes(p))
        : [...picked, ...branch.filter((b) => !picked.includes(b))],
    );
  };
  const pickedCards = picked.reduce((n, id) => n + (counts.byDeck.get(id) ?? 0), 0);

  const renderRow = (d: Deck, depth: number, hasChildren: boolean) => {
    const branch = deckBranch(decks, d.uuid);
    const on = multi && branch.every((b) => picked.includes(b));
    return (
      <View
        key={d.uuid}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 10,
          paddingRight: 12,
          paddingLeft: 12 + depth * 18,
        }}
      >
        <Pressable
          testID={`fcs-toggle-${d.uuid}`}
          accessibilityRole="button"
          disabled={!hasChildren}
          hitSlop={8}
          onPress={() => {
            const n = new Set(collapsed);
            if (n.has(d.uuid)) n.delete(d.uuid);
            else n.add(d.uuid);
            setCollapsed(n);
          }}
          style={{ width: 16, alignItems: 'center' }}
        >
          <Text style={{ color: th.text3, fontSize: 12 }}>
            {hasChildren ? (collapsed.has(d.uuid) ? '▶' : '▼') : ''}
          </Text>
        </Pressable>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: d.color + '26',
          }}
        >
          <DeckIcon name={deckIcon(d)} color={d.color} size={20} />
        </View>
        <Text
          style={{ flex: 1, color: th.text, fontSize: 16, fontWeight: '600' }}
          numberOfLines={2}
        >
          {d.name}
        </Text>
        <Text testID={`fcs-count-${d.uuid}`} style={{ color: th.text2 }}>
          {branchCount(d.uuid)}
        </Text>
        {multi ? (
          <Pressable
            testID={`fcs-pick-${d.uuid}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => togglePick(d.uuid)}
            hitSlop={8}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: 2,
              borderColor: on ? th.brand : th.hairline2,
              backgroundColor: on ? th.brand : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {on ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
          </Pressable>
        ) : (
          <Pressable
            testID={`fcs-play-${d.uuid}`}
            accessibilityRole="button"
            accessibilityLabel={t('fc.cg_gioca')}
            onPress={() => play(branch)}
            hitSlop={6}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: th.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14 }}>▶</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        top={insets.top}
        title={t('fc.cg_nuova_partita')}
        right={
          <Pressable testID="fcs-close" accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: th.brand, fontSize: 17 }}>✕</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + (multi ? 110 : 48),
          gap: 14,
        }}
      >
        <Card style={{ padding: 16, gap: 14 }}>
          {kit.vocab ? (
            <View style={{ gap: 6 }}>
              <SectionLabel>{t('fcv.verso')}</SectionLabel>
              <Segmented
                testID="fcs-direction"
                value={direction}
                onChange={setDirection}
                options={[
                  { value: 'w2t', label: t('fcv.verso_w2t') },
                  { value: 't2w', label: t('fcv.verso_t2w') },
                  { value: 'mix', label: t('fcv.verso_mix') },
                ]}
              />
            </View>
          ) : null}
          <View style={{ gap: 6 }}>
            <SectionLabel>{t('fc.cg_ordine')}</SectionLabel>
            <Segmented
              testID="fcs-order"
              value={order}
              onChange={setOrder}
              options={[
                { value: 'in_order', label: t('fc.cg_in_ordine') },
                { value: 'random', label: t('fc.cg_random') },
              ]}
            />
          </View>
          <View style={{ gap: 6 }}>
            <SectionLabel>{t('fc.cg_stato_carte')}</SectionLabel>
            <Segmented
              testID="fcs-status"
              value={status}
              onChange={setStatus}
              options={[
                { value: '0', label: t('fc.cg_to_learn') },
                { value: '1', label: t('fc.cg_learnt') },
                { value: 'all', label: t('fc.cg_tutti_stati') },
              ]}
            />
          </View>
          <View style={{ gap: 6 }}>
            <SectionLabel>{t('fc.cg_livelli')}</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LEVEL_CHOICES.map((lv) => {
                const on = levels.includes(lv);
                return (
                  <Pressable
                    key={lv}
                    testID={`fcs-level-${lv}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => setLevels(on ? levels.filter((x) => x !== lv) : [...levels, lv])}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: on ? LEVEL_COLORS[lv] : th.hairline2,
                      backgroundColor: on ? LEVEL_COLORS[lv] + '26' : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: LEVEL_COLORS[lv],
                      }}
                    />
                    <Text style={{ color: th.text, fontSize: 13, fontWeight: on ? '700' : '500' }}>
                      {t(`fcv.liv_${lv}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: th.text2, fontSize: 12 }}>{t('fc.cg_livelli_sub')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: th.text, fontWeight: '600' }}>
                {t('fc.dk_gioca_difficili')}
              </Text>
            </View>
            <Switch testID="fcs-hard" value={onlyHard} onValueChange={setOnlyHard} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: th.text, fontWeight: '600' }}>{t('fc.cg_piu_categorie')}</Text>
              <Text style={{ color: th.text2, fontSize: 13 }}>{t('fc.cg_combina')}</Text>
            </View>
            <Switch
              testID="fcs-multi"
              value={multi}
              onValueChange={(v) => {
                setMulti(v);
                setPicked([]);
              }}
              trackColor={{ true: th.brand }}
            />
          </View>
        </Card>

        {empty ? (
          <Text testID="fcs-empty" style={{ color: th.red, textAlign: 'center' }}>
            {t('fc.cg_nessuna_carta')}
          </Text>
        ) : null}

        {!multi ? (
          <Pressable
            testID="fcs-play-all"
            accessibilityRole="button"
            onPress={() => play([])}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              padding: 16,
              borderRadius: 16,
              backgroundColor: th.brand,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>{counts.all}</Text>
              <Text style={{ color: '#fff', fontSize: 15 }}>{t('fc.cg_tutte')}</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 22 }}>▶</Text>
          </Pressable>
        ) : null}

        {rows.length ? (
          <Card>
            {rows.map((r, i) => (
              <View
                key={r.deck.uuid}
                style={{ borderTopWidth: i ? 0.5 : 0, borderTopColor: th.hairline }}
              >
                {renderRow(byId.get(r.deck.uuid)!, r.depth, r.hasChildren)}
              </View>
            ))}
          </Card>
        ) : (
          <Text style={{ color: th.text2, textAlign: 'center', padding: 24 }}>
            {t('fc.cfc_nessuna_txt')}
          </Text>
        )}
      </ScrollView>

      {multi ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 16,
            paddingBottom: insets.bottom + 12,
            backgroundColor: th.surface,
            borderTopWidth: 0.5,
            borderTopColor: th.hairline,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              testID="fcs-multi-count"
              style={{ color: th.text, fontWeight: '800', fontSize: 18 }}
            >
              {pickedCards} {t('fc.cg_carte')}
            </Text>
            <Text style={{ color: th.text2, fontSize: 12 }}>{t('fc.cg_selezionate')}</Text>
          </View>
          <Pressable
            testID="fcs-multi-play"
            accessibilityRole="button"
            disabled={!picked.length}
            onPress={() => play(picked)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 22,
              borderRadius: 14,
              backgroundColor: th.brand,
              opacity: picked.length ? 1 : 0.4,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {t('fc.cg_gioca')} ▶
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
