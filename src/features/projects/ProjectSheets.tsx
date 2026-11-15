import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { localToday } from '@/features/tasks/groups';

import { PjIcon } from './PjIcons';
import type { Project } from './logic';
import { shortDate } from './pjFormat';
import type { ProjectOptions } from './options';

const ORDERS: ProjectOptions['ordine'][] = ['manuale', 'alfabetico', 'recenti', 'scadenza'];
const ORDER_KEY = {
  manuale: 'progetti.opz_manuale',
  alfabetico: 'progetti.opz_alfabetico',
  recenti: 'progetti.opz_recenti',
  scadenza: 'progetti.opz_scadenza',
} as const;
const SWITCHES = [
  ['completati', 'opz_completati', 'opz_completati_sub'],
  ['mostra_tag', 'opz_tag', 'opz_tag_sub'],
  ['ricorda_rami', 'opz_rami', 'opz_rami_sub'],
  ['solo_attivi', 'opz_attivi', 'opz_attivi_sub'],
] as const;

/** La finestra «Impostazioni» (l'ingranaggio): quattro caselle e «Ordina per». */
export function OptionsModal({
  opts,
  onChange,
  onClose,
}: {
  opts: ProjectOptions;
  onChange: (patch: Partial<ProjectOptions>) => void;
  onClose: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,.35)',
          justifyContent: 'center',
          padding: 22,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('comune.chiudi')}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          testID="proj-options-modal"
          style={{
            backgroundColor: th.surface,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16,
            maxWidth: 520,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <Text style={{ color: th.text, fontSize: 17, fontWeight: '700' }}>
              {t('progetti.impostazioni')}
            </Text>
            <Pressable
              testID="proj-options-close"
              accessibilityRole="button"
              accessibilityLabel={t('comune.chiudi')}
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: th.surface2,
              }}
            >
              <PjIcon name="close" color={th.text2} size={14} width={2.2} />
            </Pressable>
          </View>
          {SWITCHES.map(([key, label, sub]) => {
            const on = opts[key];
            return (
              <Pressable
                key={key}
                testID={`opt-${key}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => onChange({ [key]: !on })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 11,
                  paddingLeft: 6,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: th.hairline,
                }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    borderWidth: on ? 0 : 1.4,
                    borderColor: th.text3,
                    backgroundColor: on ? th.brand : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? (
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: th.text, fontSize: 16, lineHeight: 22 }}>
                    {t(`progetti.${label}`)}
                  </Text>
                  <Text style={{ color: th.text2, fontSize: 13.5, lineHeight: 18 }}>
                    {t(`progetti.${sub}`)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Text
            style={{
              color: th.text3,
              fontSize: 11.5,
              letterSpacing: 1.2,
              marginTop: 6,
              paddingTop: 14,
              marginBottom: 8,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: th.hairline,
              textTransform: 'uppercase',
            }}
          >
            {t('progetti.opz_ordine')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ORDERS.map((o) => {
              const on = opts.ordine === o;
              return (
                <Pressable
                  key={o}
                  testID={`opt-order-${o}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => onChange({ ordine: o })}
                  style={{
                    flexBasis: '48%',
                    flexGrow: 1,
                    minHeight: 39,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? th.brand : th.surface2,
                  }}
                >
                  <Text
                    style={{
                      color: on ? '#fff' : th.text3,
                      fontSize: 14,
                      fontWeight: on ? '700' : '500',
                    }}
                  >
                    {t(ORDER_KEY[o])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

type DateKind = 'due' | 'target';
type DateFilter = 'all' | 'past' | 'today' | 'future';

/** Il foglio «Scadenze e obiettivi» (il calendario in alto): tutti i progetti con una data, da filtrare e ordinare. */
export function DatesSheet({
  all,
  onOpen,
  onClose,
}: {
  all: Project[];
  onOpen: (uuid: string) => void;
  onClose: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const today = localToday();
  const [kind, setKind] = useState<DateKind>('due');
  const [filter, setFilter] = useState<DateFilter>('all');
  const [far, setFar] = useState(false);

  const dateOf = (p: Project) => (kind === 'due' ? p.due_date : p.target_date);
  const rows = all
    .filter((p) => !!dateOf(p))
    .filter((p) => {
      const d = dateOf(p)!;
      return (
        filter === 'all' ||
        (filter === 'past' ? d < today : filter === 'today' ? d === today : d > today)
      );
    })
    .sort((a, b) => (dateOf(a)! < dateOf(b)! ? -1 : dateOf(a)! > dateOf(b)! ? 1 : 0));
  if (far) rows.reverse();

  const FILTERS: [DateFilter, string][] = [
    ['all', t('progetti.tutte')],
    ['past', t('progetti.passate')],
    ['today', t('comune.oggi')],
    ['future', t('progetti.future')],
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.42)' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('comune.chiudi')}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          testID="proj-dates-sheet"
          style={{
            backgroundColor: th.surface,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            maxHeight: height * 0.85,
            paddingBottom: Math.max(insets.bottom, 14),
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View
              style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: th.hairline2 }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: th.text, fontSize: 19, fontWeight: '800' }}>
              {t('progetti.scadenze_e_obiettivi')}
            </Text>
            <Pressable
              testID="proj-dates-close"
              accessibilityRole="button"
              accessibilityLabel={t('comune.chiudi')}
              onPress={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: th.surface2,
              }}
            >
              <PjIcon name="close" color={th.text2} size={15} width={2.2} />
            </Pressable>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              gap: 10,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                padding: 3,
                gap: 2,
                borderRadius: 12,
                backgroundColor: th.surface2,
              }}
            >
              {(['due', 'target'] as const).map((k) => (
                <Pressable
                  key={k}
                  testID={`dates-kind-${k}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: kind === k }}
                  onPress={() => setKind(k)}
                  style={{
                    paddingHorizontal: 12,
                    height: 30,
                    borderRadius: 9,
                    justifyContent: 'center',
                    backgroundColor: kind === k ? th.surface : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: kind === k ? th.text : th.text2,
                      fontSize: 12.5,
                      fontWeight: '700',
                    }}
                  >
                    {k === 'due' ? t('progetti.scadenza_2') : t('progetti.obiettivo')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              testID="dates-sort"
              accessibilityRole="button"
              onPress={() => setFar(!far)}
              style={{
                paddingHorizontal: 12,
                height: 31,
                borderRadius: 11,
                justifyContent: 'center',
                backgroundColor: th.surface2,
              }}
            >
              <Text style={{ color: th.text, fontSize: 12, fontWeight: '700' }}>
                {far ? t('progetti.piu_lontane') : t('progetti.piu_vicine')}
              </Text>
            </Pressable>
          </View>
          <View
            style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 18, paddingVertical: 12 }}
          >
            {FILTERS.map(([id, label]) => (
              <Pressable
                key={id}
                testID={`dates-filter-${id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === id }}
                onPress={() => setFilter(id)}
                style={{
                  paddingHorizontal: 12,
                  height: 27,
                  borderRadius: 999,
                  justifyContent: 'center',
                  backgroundColor: filter === id ? th.brand : th.surface2,
                }}
              >
                <Text
                  style={{
                    color: filter === id ? '#fff' : th.text2,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 8 }}>
            {rows.length === 0 ? (
              <Text
                testID="dates-empty"
                style={{ color: th.text2, textAlign: 'center', paddingVertical: 24 }}
              >
                {t('progetti.nessun_progetto_data')}
              </Text>
            ) : (
              rows.map((p) => {
                const d = dateOf(p)!;
                return (
                  <Pressable
                    key={p.uuid}
                    testID={`dates-row-${p.uuid}`}
                    accessibilityRole="button"
                    onPress={() => {
                      onClose();
                      onOpen(p.uuid);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 48,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: th.hairline,
                    }}
                  >
                    <View
                      style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color }}
                    />
                    <Text numberOfLines={1} style={{ color: th.text, fontSize: 16, flex: 1 }}>
                      {p.name}
                    </Text>
                    <Text
                      style={{
                        color: d < today ? th.red : th.text2,
                        fontSize: 14,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {shortDate(d, t, today)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
