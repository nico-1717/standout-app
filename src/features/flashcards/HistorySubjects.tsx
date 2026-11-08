import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import {
  accuracyPct,
  isTouched,
  PLAYED_ORDERS,
  sortPlayed,
  sortUntouched,
  UNTOUCHED_ORDERS,
  visibleSubjects,
  type PlayedOrder,
  type SubjectTree,
  type UntouchedOrder,
} from './subjects';

/** «under 1 min», «12 min», «1h 5m» (sfc_dur_*). */
function duration(t: (k: string, o?: Record<string, unknown>) => string, seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return t('fc.sfc_dur_s');
  if (m < 60) return t('fc.sfc_dur_m', { m });
  return t('fc.sfc_dur_h', { h: Math.floor(m / 60), m: m % 60 });
}

/** «oggi», «ieri», «3 giorni fa» dall'ultima volta. */
function relative(
  t: (k: string, o?: Record<string, unknown>) => string,
  last: string,
  today: string,
): string {
  const days = Math.round(
    (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${last.slice(0, 10)}T12:00:00Z`)) / 86_400_000,
  );
  if (days <= 0) return t('fc.sfc_rel_oggi');
  if (days === 1) return t('fc.sfc_rel_ieri');
  return t('fc.sfc_rel_giorni', { n: days });
}

/**
 * Lo storico per materia (`disegnaMaterie` del sito): prima le materie giocate nel periodo (con la barra del completamento,
 * il tempo e la precisione), sotto quelle non toccate; ogni materia porta i numeri di tutto il suo ramo e si apre sui figli.
 * Toccare una materia giocata porta alle sue partite; «Gioca» fa partire una partita su tutto il ramo.
 */
export function HistorySubjects({
  tree,
  today,
  onFilter,
  onPlay,
}: {
  tree: SubjectTree;
  today: string;
  onFilter: (uuid: string, name: string) => void;
  onPlay: (uuid: string) => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [playedOrder, setPlayedOrder] = useState<PlayedOrder>('tempo');
  const [untouchedOrder, setUntouchedOrder] = useState<UntouchedOrder>('tempo_fa');
  const roots = visibleSubjects(tree, null);
  if (!roots.length) {
    return (
      <Text testID="fch-subjects-empty" style={{ color: th.text2 }}>
        {t('fc.sfc_mat_vuoto')}
      </Text>
    );
  }
  const played = roots.filter((id) => isTouched(tree.nodes.get(id)!));
  const untouched = roots.filter((id) => !isTouched(tree.nodes.get(id)!));
  const cycle = <T extends string>(all: T[], cur: T): T =>
    all[(all.indexOf(cur) + 1) % all.length]!;

  const row = (id: string, level: number): React.ReactNode => {
    const node = tree.nodes.get(id)!;
    const tot = node.total;
    const touched = isTouched(node);
    const kids = touched ? visibleSubjects(tree, id) : [];
    const isOpen = open.has(id);
    const color = node.row.color || th.brand;
    const pct = accuracyPct(tot.ok, tot.ko);
    const toLearn = tot.cards - tot.learnt;
    return (
      <View key={id}>
        <View
          testID={`fch-subject-${id}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            paddingLeft: level * 16,
          }}
        >
          {kids.length ? (
            <Pressable
              testID={`fch-subject-chev-${id}`}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              hitSlop={8}
              onPress={() => {
                const next = new Set(open);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                setOpen(next);
              }}
            >
              <Text style={{ color: th.text2, width: 16 }}>{isOpen ? '▾' : '▸'}</Text>
            </Pressable>
          ) : (
            <View style={{ width: 16 }} />
          )}
          <Pressable
            testID={`fch-subject-main-${id}`}
            accessibilityRole="button"
            disabled={!touched}
            onPress={() => onFilter(id, node.row.name)}
            style={{ flex: 1, gap: 4 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
              <Text style={{ color: th.text, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                {node.row.name}
              </Text>
            </View>
            {touched ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: th.surface2 }}
                  >
                    <View
                      style={{
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: color,
                        width: `${Math.round(tot.completion * 100)}%`,
                      }}
                    />
                  </View>
                  <Text style={{ color: th.text2, fontSize: 12 }}>{duration(t, tot.seconds)}</Text>
                </View>
                {tot.untouched > 0 ? (
                  <Text style={{ color: th.text3, fontSize: 12 }}>
                    {t(tot.untouched === 1 ? 'fc.sfc_mat_sub_non_1' : 'fc.sfc_mat_sub_non', {
                      n: tot.untouched,
                    })}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={{ color: th.text3, fontSize: 12 }}>
                {tot.last
                  ? `${t('fc.sfc_mat_ultima', { rel: relative(t, tot.last, today) })} · ${t(
                      toLearn === 1 ? 'fc.sfc_mat_da_imparare_1' : 'fc.sfc_mat_da_imparare',
                      { n: toLearn },
                    )}`
                  : `${t('fc.sfc_mai_giocata')} · ${t(
                      tot.cards === 1 ? 'fc.sfc_mat_carte_1' : 'fc.sfc_mat_carte',
                      { n: tot.cards },
                    )}`}
              </Text>
            )}
          </Pressable>
          {touched ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 10,
                backgroundColor: th.surface2,
              }}
            >
              <Text style={{ color: th.text, fontWeight: '700', fontSize: 12 }}>
                {pct === null ? '–' : `${pct}%`}
              </Text>
            </View>
          ) : (
            <Pressable
              testID={`fch-subject-play-${id}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onPlay(id)}
            >
              <Text style={{ color: th.brand, fontWeight: '600' }}>{t('fc.sfc_gioca')}</Text>
            </Pressable>
          )}
        </View>
        {isOpen ? (
          <View>
            {[
              ...sortPlayed(
                tree,
                kids.filter((k) => isTouched(tree.nodes.get(k)!)),
                playedOrder,
              ),
              ...sortUntouched(
                tree,
                kids.filter((k) => !isTouched(tree.nodes.get(k)!)),
                untouchedOrder,
              ),
            ].map((k) => row(k, level + 1))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View testID="fch-subjects" style={{ gap: 10 }}>
      <Text testID="fch-subjects-summary" style={{ color: th.text2 }}>
        {t(played.length === 1 ? 'fc.sfc_mat_riepilogo_1' : 'fc.sfc_mat_riepilogo', {
          n: played.length,
          tot: roots.length,
        })}
      </Text>
      {played.length ? (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: th.text, fontWeight: '700' }}>
              {t('fc.sfc_mat_giocate')} · {played.length}
            </Text>
            {played.length > 1 ? (
              <Pressable
                testID="fch-order-played"
                accessibilityRole="button"
                onPress={() => setPlayedOrder(cycle(PLAYED_ORDERS, playedOrder))}
              >
                <Text style={{ color: th.brand }}>{t(`fc.sfc_ms_${playedOrder}`)} ⇅</Text>
              </Pressable>
            ) : null}
          </View>
          {sortPlayed(tree, played, playedOrder).map((id) => row(id, 0))}
        </View>
      ) : null}
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: th.text, fontWeight: '700' }}>
            {t('fc.sfc_mat_non_toccate')} · {untouched.length}
          </Text>
          {untouched.length > 1 ? (
            <Pressable
              testID="fch-order-untouched"
              accessibilityRole="button"
              onPress={() => setUntouchedOrder(cycle(UNTOUCHED_ORDERS, untouchedOrder))}
            >
              <Text style={{ color: th.brand }}>{t(`fc.sfc_ms_${untouchedOrder}`)} ⇅</Text>
            </Pressable>
          ) : null}
        </View>
        {untouched.length ? (
          sortUntouched(tree, untouched, untouchedOrder).map((id) => row(id, 0))
        ) : (
          <Text style={{ color: th.text3, fontSize: 13 }}>{t('fc.sfc_tutte_toccate')}</Text>
        )}
      </View>
    </View>
  );
}
